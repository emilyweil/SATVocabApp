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
      interval: card.interval,
      repetition: card.repetition,
      easeFactor: parseFloat(card.ease_factor),
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
