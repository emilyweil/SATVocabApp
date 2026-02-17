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
  const prevRep = parseInt(card.repetition, 10) || 0
  const prevEF = parseFloat(card.easeFactor) || 2.5
  const c = { ...card, lastReview: getToday() }

  if (wasCorrect) {
    c.repetition = prevRep + 1
    c.easeFactor = Math.max(1.3, prevEF + 0.1)
    c.interval = c.repetition <= SRS_INTERVALS.length - 1
      ? SRS_INTERVALS[c.repetition]
      : Math.round(card.interval * c.easeFactor)
    // 2+ consecutive correct = mastered, 1 = review
    c.status = c.repetition >= 2 ? 'mastered' : 'review'
  } else {
    c.repetition = 0
    c.interval = 0
    c.easeFactor = Math.max(1.3, prevEF - 0.2)
    c.status = 'learning'
  }

  const next = new Date()
  next.setDate(next.getDate() + c.interval)
  c.nextReview = next.toISOString().split('T')[0]

  console.log(`[SRS] ${c.word}: ${wasCorrect ? '✓' : '✗'} | rep ${prevRep}→${c.repetition} | status→${c.status} | interval→${c.interval}`)
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
    .filter((c) => c && isDueForReview(c) && c.status !== 'mastered')
    .sort((a, b) => {
      const p = { learning: 0, new: 0, review: 1, mastered: 2 }
      return (p[a.status] || 0) - (p[b.status] || 0) || (a.nextReview < b.nextReview ? -1 : 1)
    })
    .map((c) => c.word)
    .slice(0, 10)

  return { newWords, reviewWords }
}

export function getStats(wordsIntroduced, srsCards) {
  let learning = 0, review = 0, mastered = 0
  wordsIntroduced.forEach((w) => {
    const c = srsCards[w]
    if (!c) return
    const rep = parseInt(c.repetition, 10) || 0
    if (rep >= 2 || c.status === 'mastered') mastered++
    else if (rep === 1 || c.status === 'review') review++
    else learning++ // includes 'new', 'learning', and any card with rep=0
  })
  return { learning, review, mastered, totalIntroduced: wordsIntroduced.length }
}
