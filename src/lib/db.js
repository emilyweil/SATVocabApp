import { supabase } from './supabase.js'

// ── Profile ──

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error && error.code === 'PGRST116') return null // not found
  if (error) throw error
  return data
}

export async function updateProfile(userId, updates) {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  if (error) throw error
}

export async function createProfile(userId, name) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      name,
      streak: 0,
      best_streak: 0,
      last_session_date: null,
      today_complete: false,
      sprints_today: 0,
      sessions_completed: 0,
      total_correct: 0,
      total_answered: 0,
      words_introduced: [],
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── SRS Cards ──

export async function getSRSCards(userId) {
  const { data, error } = await supabase
    .from('srs_cards')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  // Convert to a map keyed by word
  const cards = {}
  ;(data || []).forEach(card => {
    cards[card.word] = {
      word: card.word,
      interval: parseInt(card.interval, 10) || 0,
      repetition: parseInt(card.repetition, 10) || 0,
      easeFactor: parseFloat(card.ease_factor) || 2.5,
      nextReview: card.next_review,
      lastReview: card.last_review,
      status: card.status,
    }
  })
  return cards
}

export async function upsertSRSCards(userId, cardsMap) {
  // cardsMap: { word: { word, interval, repetition, easeFactor, nextReview, lastReview, status } }
  const rows = Object.values(cardsMap).map(c => ({
    user_id: userId,
    word: c.word,
    interval: c.interval,
    repetition: c.repetition,
    ease_factor: c.easeFactor,
    next_review: c.nextReview,
    last_review: c.lastReview,
    status: c.status,
  }))
  if (rows.length === 0) return
  const { error } = await supabase
    .from('srs_cards')
    .upsert(rows, { onConflict: 'user_id,word' })
  if (error) throw error
}

// ── Social: Follows ──

export async function searchUsers(query) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .ilike('name', `%${query}%`)
    .limit(20)
  if (error) throw error
  return data || []
}

export async function getFollowing(userId) {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id, profiles!follows_following_id_fkey(id, name)')
    .eq('follower_id', userId)
  if (error) throw error
  return (data || []).map(r => r.profiles).filter(Boolean)
}

export async function followUser(userId, targetId) {
  const { error } = await supabase
    .from('follows')
    .upsert({ follower_id: userId, following_id: targetId }, { onConflict: 'follower_id,following_id' })
  if (error) throw error
}

export async function unfollowUser(userId, targetId) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', userId)
    .eq('following_id', targetId)
  if (error) throw error
}

// ── Social: Messages ──

export async function sendMessage(fromId, toId, vocabWord, messageBody, messageType = 'general') {
  const { error } = await supabase
    .from('messages')
    .insert({
      from_user: fromId,
      to_user: toId,
      vocab_word: vocabWord,
      message_body: messageBody,
      message_type: messageType,
      read: false,
    })
  if (error) throw error
}

export async function getMessages(userId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, profiles!messages_from_user_fkey(name)')
    .eq('to_user', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data || []).map(m => ({
    ...m,
    from_name: m.profiles?.name || 'Someone',
  }))
}

export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('to_user', userId)
    .eq('read', false)
  if (error) throw error
  return count || 0
}

export async function markMessagesRead(userId) {
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('to_user', userId)
    .eq('read', false)
  if (error) throw error
}
