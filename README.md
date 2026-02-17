# SAT Vocab App

A Duolingo-style spaced repetition app for mastering 1,000 SAT vocabulary words. Built with React + Vite, Supabase for auth and data, deployable on Vercel.

## Features

- **1,000 SAT words** with definitions and playful example sentences
- **Spaced repetition (SRS)** using a modified SM-2 algorithm
- **Daily sessions**: Learn 5 new words → Quiz → Practice difficult words
- **Streak tracking** with daily completion requirements
- **Bonus sprints** for extra practice after completing the day
- **Progress tracking** across devices (synced via Supabase)

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** and give it a name
3. Wait for the project to finish setting up (~2 minutes)

### 2. Run the Database Setup

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Paste the entire contents of `supabase-setup.sql` and click **Run**
4. You should see "Success. No rows returned" — that means it worked

### 3. Enable Email Auth

1. In Supabase, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled (it should be by default)
3. For development, go to **Authentication** → **Settings** and disable **Confirm email** so you can sign up without email verification

### 4. Get Your API Keys

1. Go to **Settings** → **API**
2. Copy the **Project URL** (looks like `https://abc123.supabase.co`)
3. Copy the **anon/public** key (the long string under "Project API keys")

### 5. Configure the App

```bash
# Clone and install
git clone <your-repo-url>
cd sat-vocab-app
npm install

# Create your environment file
cp .env.example .env
```

Edit `.env` and paste your Supabase values:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 6. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Deploy to Vercel

### Option A: Via Vercel Dashboard (easiest)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and click **Import Project**
3. Select your GitHub repo
4. Add environment variables:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
5. Click **Deploy**

### Option B: Via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

Add env vars in the Vercel dashboard under **Settings** → **Environment Variables**.

### Important: Update Supabase Redirect URLs

After deploying, go to your Supabase dashboard → **Authentication** → **URL Configuration** and add your Vercel URL (e.g., `https://sat-vocab-app.vercel.app`) to the **Redirect URLs** list.

## Project Structure

```
sat-vocab-app/
├── index.html              # Entry HTML
├── package.json
├── vite.config.js
├── supabase-setup.sql      # Run this in Supabase SQL Editor
├── .env.example            # Template for environment variables
└── src/
    ├── main.jsx            # React mount point
    ├── App.jsx             # Main app component (all screens)
    ├── data/
    │   └── words.json      # 1,000 SAT words with definitions & sentences
    └── lib/
        ├── supabase.js     # Supabase client init
        ├── db.js           # Database helpers (profiles, SRS cards)
        └── srs.js          # Spaced repetition algorithm
```

## How the SRS Works

The app uses a modified SM-2 spaced repetition algorithm:

- **Correct answer**: Interval increases (1→3→7→14→30→60→120 days), ease factor goes up
- **Wrong answer**: Interval resets to 0, ease factor decreases, card returns to "learning"
- **Status progression**: New → Learning → Review → Mastered (mastered = 30+ day interval)
- **Daily reviews**: Cards due today appear in the quiz alongside new words

## Database Schema

**profiles** — one row per user: streak, session stats, list of introduced words

**srs_cards** — one row per user+word: interval, repetition count, ease factor, next review date, status
