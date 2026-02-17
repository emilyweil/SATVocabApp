const SRS_INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120]

export function getToday() {
  return new Date().toISOString().split('T')[0]
}

export function createSRSCard(word) {
  return {
    word,
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReview: getToday(),
    lastReview: null,
    status: 'new',
  }
}

export function updateSRSCard(card, wasCorrect) {
  const c = { ...card, lastReview: getToday() }
  if (wasCorrect) {
    c.repetition = card.repetition + 1
    c.easeFactor = Math.max(1.3, card.easeFactor + 0.1)
    c.interval =
      c.repetition <= SRS_INTERVALS.length - 1
        ? SRS_INTERVALS[c.repetition]
        : Math.round(card.interval * card.easeFactor)
    c.status = c.interval >= 3 ? 'mastered' : c.interval >= 1 ? 'review' : 'learning'
  } else {
    c.repetition = 0
    c.interval = 0
    c.easeFactor = Math.max(1.3, card.easeFactor - 0.2)
    c.status = 'learning'
  }
  const next = new Date()
  next.setDate(next.getDate() + c.interval)
  c.nextReview = next.toISOString().split('T')[0]
  return c
}

export function isDueForReview(card) {
  return card.nextReview <= getToday()
}

export function getIntervalLabel(days) {
  if (days === 0) return 'Now'
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
  if (days === 7) return '1 week'
  if (days < 30) return `${Math.round(days / 7)} weeks`
  if (days === 30) return '1 month'
  if (days < 365) return `${Math.round(days / 30)} months`
  return `${Math.round(days / 365)} years`
}

export function buildDailySession(wordsIntroduced, srsCards, allWords) {
  const introducedSet = new Set(wordsIntroduced)
  const newWords = allWords
    .filter((w) => !introducedSet.has(w.word))
    .slice(0, 5)
    .map((w) => w.word)

  const reviewWords = wordsIntroduced
    .map((w) => srsCards[w])
    .filter((c) => c && isDueForReview(c))
    .sort((a, b) => {
      const p = { learning: 0, new: 0, review: 1, mastered: 2 }
      return (p[a.status] || 0) - (p[b.status] || 0) || (a.nextReview < b.nextReview ? -1 : 1)
    })
    .map((c) => c.word)
    .slice(0, 10)

  const difficultWords = wordsIntroduced
    .map((w) => srsCards[w])
    .filter((c) => c && (c.status === 'learning' || c.status === 'new') && c.lastReview)
    .sort((a, b) => a.easeFactor - b.easeFactor)
    .map((c) => c.word)

  return { newWords, reviewWords, difficultWords }
}

export function getStats(wordsIntroduced, srsCards) {
  let learning = 0,
    review = 0,
    mastered = 0
  wordsIntroduced.forEach((w) => {
    const c = srsCards[w]
    if (!c) return
    if (c.status === 'new' || c.status === 'learning') learning++
    else if (c.status === 'review') review++
    else if (c.status === 'mastered') mastered++
  })
  return { learning, review, mastered, totalIntroduced: wordsIntroduced.length }
}
