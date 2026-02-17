-- ============================================================
-- SAT Vocab App — Supabase Setup
-- Run this in your Supabase SQL Editor (supabase.com → project → SQL Editor)
-- ============================================================

-- 1. Profiles table (one row per user)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  streak integer default 0,
  best_streak integer default 0,
  last_session_date date,
  today_complete boolean default false,
  sprints_today integer default 0,
  sessions_completed integer default 0,
  total_correct integer default 0,
  total_answered integer default 0,
  words_introduced text[] default '{}',
  created_at timestamptz default now()
);

-- 2. SRS cards table (one row per user + word combination)
create table srs_cards (
  id bigserial primary key,
  user_id uuid references auth.users on delete cascade not null,
  word text not null,
  interval integer default 0,
  repetition integer default 0,
  ease_factor numeric default 2.5,
  next_review date default current_date,
  last_review date,
  status text default 'new',
  created_at timestamptz default now(),
  unique(user_id, word)
);

-- 3. Index for fast lookups
create index idx_srs_cards_user on srs_cards(user_id);
create index idx_srs_cards_review on srs_cards(user_id, next_review);

-- 4. Enable Row Level Security
alter table profiles enable row level security;
alter table srs_cards enable row level security;

-- 5. Profiles policies — users can only access their own row
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- 6. SRS cards policies — users can only access their own cards
create policy "Users can view own cards"
  on srs_cards for select using (auth.uid() = user_id);

create policy "Users can insert own cards"
  on srs_cards for insert with check (auth.uid() = user_id);

create policy "Users can update own cards"
  on srs_cards for update using (auth.uid() = user_id);

-- 7. Function to auto-create profile on signup (optional but nice)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Student'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
