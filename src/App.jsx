import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './lib/supabase.js'
import { getProfile, updateProfile, createProfile, getSRSCards, upsertSRSCards } from './lib/db.js'
import { getToday, createSRSCard, updateSRSCard, isDueForReview, getIntervalLabel, buildDailySession, getStats } from './lib/srs.js'
import VOCABULARY from './data/words.json'

// ═══════════════════════════════════════════════════════════════
// CAT MASCOT (inline SVG)
// ═══════════════════════════════════════════════════════════════
const CatMascot = ({ size = 120, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={style}>
    {/* Body */}
    <ellipse cx="60" cy="75" rx="35" ry="30" fill="#FFB347"/>
    {/* Head */}
    <circle cx="60" cy="42" r="28" fill="#FFB347"/>
    {/* Left ear */}
    <polygon points="38,22 28,2 48,14" fill="#FFB347"/>
    <polygon points="40,20 32,6 47,16" fill="#FFD1A9"/>
    {/* Right ear */}
    <polygon points="82,22 92,2 72,14" fill="#FFB347"/>
    <polygon points="80,20 88,6 73,16" fill="#FFD1A9"/>
    {/* Eyes */}
    <ellipse cx="48" cy="40" rx="5" ry="5.5" fill="#4B4B4B"/>
    <ellipse cx="72" cy="40" rx="5" ry="5.5" fill="#4B4B4B"/>
    <ellipse cx="49.5" cy="38.5" rx="2" ry="2" fill="white"/>
    <ellipse cx="73.5" cy="38.5" rx="2" ry="2" fill="white"/>
    {/* Nose */}
    <ellipse cx="60" cy="48" rx="3" ry="2" fill="#FF8C94"/>
    {/* Mouth */}
    <path d="M55 51 Q60 56 65 51" stroke="#4B4B4B" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    {/* Whiskers */}
    <line x1="25" y1="44" x2="44" y2="47" stroke="#4B4B4B" strokeWidth="1" strokeLinecap="round"/>
    <line x1="25" y1="50" x2="44" y2="50" stroke="#4B4B4B" strokeWidth="1" strokeLinecap="round"/>
    <line x1="76" y1="47" x2="95" y2="44" stroke="#4B4B4B" strokeWidth="1" strokeLinecap="round"/>
    <line x1="76" y1="50" x2="95" y2="50" stroke="#4B4B4B" strokeWidth="1" strokeLinecap="round"/>
    {/* Belly */}
    <ellipse cx="60" cy="80" rx="20" ry="18" fill="#FFD1A9"/>
    {/* Paws */}
    <ellipse cx="40" cy="100" rx="10" ry="6" fill="#FFB347"/>
    <ellipse cx="80" cy="100" rx="10" ry="6" fill="#FFB347"/>
    {/* Tail */}
    <path d="M90 85 Q110 70 105 50" stroke="#FFB347" strokeWidth="8" fill="none" strokeLinecap="round"/>
    {/* Graduation cap */}
    <rect x="40" y="16" width="40" height="4" rx="1" fill="#4B4B4B"/>
    <polygon points="60,6 42,18 78,18" fill="#4B4B4B"/>
    <line x1="78" y1="18" x2="82" y2="28" stroke="#4B4B4B" strokeWidth="1.5"/>
    <circle cx="82" cy="29" r="2" fill="#FFD700"/>
  </svg>
)

// ═══════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════
const C = {
  green: '#58CC02', greenDark: '#4CAD00', greenLight: '#D7FFB8',
  blue: '#1CB0F6', blueDark: '#1899D6',
  orange: '#FF9600', orangeLight: '#FFF3E0',
  red: '#FF4B4B', redLight: '#FFE0E0',
  purple: '#CE82FF', purpleLight: '#F3E8FF',
  gray: '#AFAFAF', grayLight: '#E5E5E5', grayDark: '#4B4B4B',
  white: '#FFFFFF', bg: '#F7F7F7',
}

// ═══════════════════════════════════════════════════════════════
// WORD LOOKUP HELPERS
// ═══════════════════════════════════════════════════════════════
const wordMap = {}
VOCABULARY.forEach(w => { wordMap[w.word.toLowerCase()] = w })

function getWordData(word) {
  return wordMap[word.toLowerCase()] || { word, definition: 'Definition unavailable', sentence: '' }
}

// ═══════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════════════════
const FlameIcon = ({ size = 24, active = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C12 2 4 10 4 15C4 19.4 7.6 22 12 22C16.4 22 20 19.4 20 15C20 10 12 2 12 2Z" fill={active ? '#FF9600' : '#E5E5E5'} />
    <path d="M12 8C12 8 8 13 8 16C8 18.8 9.8 20 12 20C14.2 20 16 18.8 16 16C16 13 12 8 12 8Z" fill={active ? '#FFC800' : '#AFAFAF'} />
  </svg>
)

const SRSBadge = ({ interval, status }) => {
  const colors = { new: { bg: '#E8F5FE', t: C.blue }, learning: { bg: C.orangeLight, t: C.orange }, review: { bg: C.purpleLight, t: C.purple }, mastered: { bg: C.greenLight, t: C.greenDark } }
  const col = colors[status] || colors.new
  const label = status === 'mastered' ? '✓ Mastered' : status === 'new' ? 'New' : `Next: ${getIntervalLabel(interval)}`
  return <span style={{ padding: '3px 10px', background: col.bg, color: col.t, borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{label}</span>
}

const StrengthBars = ({ repetition, size = 20 }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: size }}>
    {[1,2,3,4,5].map(i => <div key={i} style={{ width: 4, height: (i/5)*size, borderRadius: 2, background: i <= repetition ? C.green : '#E5E5E5' }} />)}
  </div>
)

const CheckCircle = ({ done, color = C.green }) => (
  <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${done ? color : '#E0E0E0'}`, background: done ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </div>
)

const Spinner = ({ text = 'Loading...' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40 }}>
    <div style={{ width: 36, height: 36, border: `4px solid ${C.grayLight}`, borderTopColor: C.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <p style={{ color: C.gray, fontSize: 14 }}>{text}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

// ═══════════════════════════════════════════════════════════════
// LOGIN SCREEN (Supabase Auth)
// ═══════════════════════════════════════════════════════════════
function LoginScreen({ onAuthComplete }) {
  const [mode, setMode] = useState(null) // null | 'signup' | 'login'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return
    if (mode === 'signup' && !name.trim()) return
    setLoading(true)
    setError('')

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: { data: { name: name.trim() } },
        })
        if (signUpError) throw signUpError
        // Create profile (trigger may also create it, upsert is safe)
        if (data.user) {
          await createProfile(data.user.id, name.trim())
          onAuthComplete(data.user)
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        })
        if (signInError) throw signInError
        if (data.user) onAuthComplete(data.user)
      }
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <CatMascot size={140} style={{ marginBottom: 16 }} />
      <h1 style={{ fontSize: 28, fontWeight: 800, color: C.grayDark, margin: '0 0 4px' }}>SAT Vocab</h1>
      <p style={{ color: C.gray, margin: '0 0 32px', fontSize: 15 }}>Master 1,000 SAT words, one day at a time!</p>

      {!mode ? (
        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setMode('signup')} style={{ width: '100%', padding: '14px 0', background: C.green, color: 'white', fontWeight: 700, fontSize: 14, letterSpacing: 1, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}`, textTransform: 'uppercase' }}>SIGN UP</button>
          <button onClick={() => setMode('login')} style={{ width: '100%', padding: '14px 0', background: 'white', color: C.blue, fontWeight: 700, fontSize: 14, letterSpacing: 1, border: '2px solid #E5E5E5', borderRadius: 16, cursor: 'pointer', textTransform: 'uppercase' }}>LOGIN</button>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} autoFocus
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #E5E5E5', borderRadius: 16, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoFocus={mode === 'login'}
            style={{ width: '100%', padding: '14px 16px', border: '2px solid #E5E5E5', borderRadius: 16, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
          <input type="password" placeholder="Password (6+ characters)" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ width: '100%', padding: '14px 16px', border: '2px solid #E5E5E5', borderRadius: 16, fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
          {error && <p style={{ color: C.red, fontSize: 13, margin: 0 }}>{error}</p>}
          <button onClick={handleSubmit} disabled={loading}
            style={{ width: '100%', padding: '14px 0', background: C.green, color: 'white', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 16, cursor: loading ? 'default' : 'pointer', boxShadow: `0 4px 0 ${C.greenDark}`, textTransform: 'uppercase', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Loading...' : mode === 'signup' ? 'GET STARTED' : 'LOGIN'}
          </button>
          <button onClick={() => { setMode(null); setError('') }} style={{ background: 'none', border: 'none', color: C.gray, cursor: 'pointer', fontSize: 14 }}>← Back</button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════
function HomeScreen({ profile, srsCards, onStartSession, onViewWords, onLogout, onBrowse }) {
  const stats = getStats(profile.words_introduced, srsCards)
  const today = getToday()
  const dayDone = profile.today_complete && profile.last_session_date === today

  const introduced = profile.words_introduced || []
  const learningWords = introduced.filter(w => srsCards[w] && (srsCards[w].status === 'learning' || srsCards[w].status === 'new'))
  const reviewingWords = introduced.filter(w => srsCards[w] && srsCards[w].status === 'review')
  const masteredWords = introduced.filter(w => srsCards[w] && srsCards[w].status === 'mastered')

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: 'white', padding: '16px 20px', borderBottom: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlameIcon size={28} active={profile.streak > 0} />
          <span style={{ fontWeight: 800, fontSize: 18, color: profile.streak > 0 ? '#FF9600' : C.gray }}>{profile.streak}</span>
        </div>
        <span style={{ fontWeight: 700, color: C.grayDark, fontSize: 14 }}>{profile.best_streak > 1 ? `Best: ${profile.best_streak} days` : ''}</span>
        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: C.gray, cursor: 'pointer', fontSize: 13 }}>Sign Out</button>
      </div>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <CatMascot size={100} />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.grayDark, margin: '12px 0 4px' }}>
            {dayDone ? '🎉 Day complete!' : `Hey, ${profile.name}!`}
          </h2>
          <p style={{ color: C.gray, margin: 0, fontSize: 14 }}>
            {dayDone ? `You're on a ${profile.streak}-day streak! See you tomorrow.` : "Complete today's session to keep your streak."}
          </p>
          {dayDone && profile.sprints_today > 0 && <p style={{ color: C.purple, margin: '4px 0 0', fontSize: 13, fontWeight: 600 }}>+{profile.sprints_today} extra practice session{profile.sprints_today > 1 ? 's' : ''} today!</p>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Learning', value: stats.learning, color: C.orange, words: learningWords },
            { label: 'Reviewing', value: stats.review, color: C.purple, words: reviewingWords },
            { label: 'Mastered', value: stats.mastered, color: C.green, words: masteredWords },
          ].map((s, i) => (
            <div key={i} onClick={() => s.words.length > 0 && onBrowse({ title: s.label, words: s.words, color: s.color })}
              style={{ flex: 1, background: 'white', borderRadius: 16, padding: '12px 8px', textAlign: 'center', border: '2px solid #F0F0F0', cursor: s.words.length > 0 ? 'pointer' : 'default', transition: 'transform 0.1s' }}
              onMouseDown={e => { if (s.words.length > 0) e.currentTarget.style.transform = 'scale(0.97)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: C.gray, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '2px solid #F0F0F0', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.grayDark }}>Overall Progress</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{stats.mastered}/{VOCABULARY.length}</span>
          </div>
          <div style={{ height: 14, background: '#E5E5E5', borderRadius: 7, overflow: 'hidden', display: 'flex' }}>
            <div style={{ height: '100%', width: `${(stats.mastered / VOCABULARY.length) * 100}%`, background: C.green, transition: 'width 0.5s' }} />
            <div style={{ height: '100%', width: `${(stats.review / VOCABULARY.length) * 100}%`, background: C.purple, transition: 'width 0.5s' }} />
            <div style={{ height: '100%', width: `${(stats.learning / VOCABULARY.length) * 100}%`, background: C.orange, transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {[{ c: C.green, l: 'Mastered' }, { c: C.purple, l: 'Reviewing' }, { c: C.orange, l: 'Learning' }].map((x, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 4, background: x.c }} /><span style={{ fontSize: 10, color: C.gray }}>{x.l}</span></div>
            ))}
          </div>
        </div>

        {!dayDone ? (
          <button onClick={() => onStartSession(false)} style={{ width: '100%', padding: '18px 0', background: C.green, color: 'white', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}` }}>Start Today's Session</button>
        ) : (
          <button onClick={() => onStartSession(true)} style={{ width: '100%', padding: '16px 0', background: C.purple, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: '0 4px 0 #A855F7' }}>Keep Practicing 💪</button>
        )}
        <button onClick={onViewWords} style={{ width: '100%', padding: '14px 0', background: 'transparent', color: C.gray, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', marginTop: 8 }}>View All Words</button>
        <p style={{ textAlign: 'center', color: C.gray, fontSize: 12, marginTop: 8 }}>About 5–10 minutes</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DAILY SESSION — Learn → Quiz → Practice → Celebration
// ═══════════════════════════════════════════════════════════════
function DailySession({ userId, profile, srsCards, onComplete, onSave, isSprint }) {
  const [phase, setPhase] = useState('init')
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [quizWords, setQuizWords] = useState([])
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [results, setResults] = useState([])
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [practiceFlipped, setPracticeFlipped] = useState(false)
  const [practiceWords, setPracticeWords] = useState([])
  const [sessionNewWords, setSessionNewWords] = useState([])
  const [sessionReviewWords, setSessionReviewWords] = useState([])

  // Local mutable copy of cards for this session
  const [localCards, setLocalCards] = useState({ ...srsCards })
  const [localIntroduced, setLocalIntroduced] = useState([...(profile.words_introduced || [])])

  useEffect(() => {
    const session = buildDailySession(localIntroduced, localCards, VOCABULARY)
    setSessionNewWords(session.newWords)
    setSessionReviewWords(session.reviewWords)
    if (session.newWords.length > 0) setPhase('learn')
    else if (session.newWords.length + session.reviewWords.length > 0) buildAndStartQuiz(session.newWords, session.reviewWords)
    else {
      const diff = session.difficultWords.slice(0, 8)
      if (diff.length > 0) { setPracticeWords(diff); setPhase('practice') }
      else { completeDayAndSave(localCards, localIntroduced); setPhase('celebration') }
    }
  }, [])

  const buildAndStartQuiz = (newW, revW) => {
    const all = [...newW, ...revW].filter((w, i, a) => a.indexOf(w) === i)
    if (all.length === 0) { finishQuiz([]); return }
    const shuffled = [...all].sort(() => Math.random() - 0.5)
    const withOpts = shuffled.map(word => {
      const correctDef = getWordData(word).definition
      const wrongDefs = VOCABULARY.filter(w => w.word !== word).sort(() => Math.random() - 0.5).slice(0, 3).map(w => w.definition)
      return { word, options: [correctDef, ...wrongDefs].sort(() => Math.random() - 0.5) }
    })
    setQuizWords(withOpts); setPhase('quiz'); setQIndex(0); setSelected(null); setShowFeedback(false); setResults([])
  }

  const startQuiz = () => buildAndStartQuiz(sessionNewWords, sessionReviewWords)

  const selectAnswer = (ans) => { if (showFeedback) return; setSelected(ans); setShowFeedback(true) }

  const continueQuiz = () => {
    const w = quizWords[qIndex]
    const correctDef = getWordData(w.word).definition
    const wasCorrect = selected === correctDef
    const existing = localCards[w.word] || createSRSCard(w.word)
    const updated = updateSRSCard(existing, wasCorrect)
    const newResults = [...results, { word: w.word, wasCorrect, newCard: updated }]
    if (qIndex < quizWords.length - 1) {
      setResults(newResults); setQIndex(qIndex + 1); setSelected(null); setShowFeedback(false)
    } else {
      finishQuiz(newResults)
    }
  }

  const finishQuiz = async (quizResults) => {
    const newCards = { ...localCards }
    const newIntroduced = [...localIntroduced]
    quizResults.forEach(r => { newCards[r.word] = r.newCard; if (!newIntroduced.includes(r.word)) newIntroduced.push(r.word) })
    sessionNewWords.forEach(w => { if (!newIntroduced.includes(w)) newIntroduced.push(w); if (!newCards[w]) newCards[w] = createSRSCard(w) })
    setLocalCards(newCards)
    setLocalIntroduced(newIntroduced)
    setResults(quizResults)

    const difficultWordList = newIntroduced.map(w => newCards[w]).filter(c => c && (c.status === 'learning' || c.status === 'new') && c.lastReview).sort((a, b) => a.easeFactor - b.easeFactor).slice(0, 8).map(c => c.word)
    if (difficultWordList.length > 0) {
      setPracticeWords(difficultWordList); setPracticeIndex(0); setPracticeFlipped(false)
      // Save partial progress
      await saveToDB(newCards, newIntroduced, false, quizResults)
      setPhase('practice')
    } else {
      await completeDayAndSave(newCards, newIntroduced, quizResults)
      setPhase('celebration')
    }
  }

  const saveToDB = async (cards, introduced, dayComplete, quizResults) => {
    try {
      // Save SRS cards
      const changedCards = {}
      Object.keys(cards).forEach(w => { if (cards[w]) changedCards[w] = cards[w] })
      await upsertSRSCards(userId, changedCards)

      // Update profile
      const finalResults = quizResults || results || []
      const correctCount = finalResults.filter(r => r.wasCorrect).length
      const updates = {
        words_introduced: introduced,
        total_correct: profile.total_correct + correctCount,
        total_answered: profile.total_answered + finalResults.length,
      }
      if (dayComplete) {
        const today = getToday()
        const alreadyDone = profile.today_complete && profile.last_session_date === today
        if (isSprint && alreadyDone) {
          updates.sprints_today = (profile.sprints_today || 0) + 1
        } else if (!alreadyDone) {
          updates.streak = (profile.streak || 0) + 1
          updates.best_streak = Math.max(profile.best_streak || 0, updates.streak)
          updates.last_session_date = today
          updates.today_complete = true
          updates.sessions_completed = (profile.sessions_completed || 0) + 1
          updates.sprints_today = 0
        }
      }
      await updateProfile(userId, updates)
      // Tell parent to refresh and wait for it
      await onSave()
    } catch (e) {
      console.error('Save error:', e)
    }
  }

  const completeDayAndSave = async (cards, introduced, quizResults) => {
    await saveToDB(cards, introduced, true, quizResults)
  }

  const finishPractice = async () => {
    await completeDayAndSave(localCards, localIntroduced)
    setPhase('celebration')
  }

  // ── LOADING ──
  if (phase === 'init') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <CatMascot size={80} style={{ marginBottom: 8 }} /><Spinner text="Preparing your words..." />
    </div>
  )

  // ── LEARN ──
  if (phase === 'learn') {
    const word = sessionNewWords[cardIndex]
    const data = getWordData(word)
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0' }}>
          <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onComplete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20 }}>✕</button>
            <div style={{ flex: 1, height: 12, background: '#E5E5E5', borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${((cardIndex + 1) / sessionNewWords.length) * 100}%`, background: C.blue, borderRadius: 6, transition: 'width 0.3s' }} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.gray }}>{cardIndex + 1} / {sessionNewWords.length}</span>
          </div>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>📚</span><span style={{ color: C.blue, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Learn New Words</span>
          </div>
          <p style={{ color: C.gray, fontSize: 13, margin: '0 0 20px' }}>Card {cardIndex + 1} of {sessionNewWords.length} · Tap to flip</p>
          <div onClick={() => setFlipped(!flipped)} style={{ width: '100%', maxWidth: 340, height: 280, cursor: 'pointer', perspective: 1000 }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', transition: 'transform 0.5s', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', background: 'white', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '2px solid #F0F0F0' }}>
                <h2 style={{ fontSize: 30, fontWeight: 800, color: C.grayDark, margin: '0 0 16px' }}>{word}</h2>
                <p style={{ color: C.gray, textAlign: 'center', fontStyle: 'italic', fontSize: 15, lineHeight: 1.6 }}>"{data.sentence}"</p>
                <p style={{ color: '#D0D0D0', fontSize: 12, marginTop: 16 }}>Tap to see definition →</p>
              </div>
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: `linear-gradient(135deg, ${C.blue}, ${C.blueDark})`, borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 12px' }}>{word}</h2>
                <p style={{ color: 'rgba(255,255,255,0.95)', textAlign: 'center', fontSize: 18, lineHeight: 1.5 }}>{data.definition}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={() => { setCardIndex(Math.max(0, cardIndex - 1)); setFlipped(false) }} disabled={cardIndex === 0}
              style={{ padding: '12px 24px', borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: cardIndex === 0 ? 'default' : 'pointer', border: cardIndex === 0 ? 'none' : `2px solid ${C.blue}`, background: cardIndex === 0 ? '#E5E5E5' : 'white', color: cardIndex === 0 ? C.gray : C.blue }}>← Back</button>
            <button onClick={() => { setCardIndex(Math.min(sessionNewWords.length - 1, cardIndex + 1)); setFlipped(false) }} disabled={cardIndex === sessionNewWords.length - 1}
              style={{ padding: '12px 24px', borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: cardIndex === sessionNewWords.length - 1 ? 'default' : 'pointer', border: 'none', background: cardIndex === sessionNewWords.length - 1 ? '#E5E5E5' : C.blue, color: cardIndex === sessionNewWords.length - 1 ? C.gray : 'white', boxShadow: cardIndex === sessionNewWords.length - 1 ? 'none' : `0 4px 0 ${C.blueDark}` }}>Next →</button>
          </div>
          <button onClick={startQuiz} style={{ width: '100%', maxWidth: 340, padding: '16px 0', marginTop: 24, background: C.green, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}` }}>I'm Ready for the Quiz! ✍️</button>
        </div>
      </div>
    )
  }

  // ── QUIZ ──
  if (phase === 'quiz') {
    const q = quizWords[qIndex]
    const data = getWordData(q.word)
    const isCorrect = selected === data.definition
    const existingCard = localCards[q.word]
    const isReview = existingCard && existingCard.status !== 'new'
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0' }}>
          <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onComplete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20 }}>✕</button>
            <div style={{ flex: 1, height: 12, background: '#E5E5E5', borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${((qIndex + 1) / quizWords.length) * 100}%`, background: C.green, borderRadius: 6, transition: 'width 0.3s' }} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.gray }}>{qIndex + 1} / {quizWords.length}</span>
          </div>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>✍️</span><p style={{ color: C.grayDark, fontWeight: 700, fontSize: 16, margin: 0 }}>What does this word mean?</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: C.blue, margin: 0 }}>{q.word}</h2>
            {isReview && <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: C.purpleLight, color: C.purple }}>REVIEW</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.options.map((opt, i) => {
              let bg = 'white', border = '2px solid #E5E5E5', color = C.grayDark
              if (showFeedback) {
                if (opt === data.definition) { bg = C.greenLight; border = `2px solid ${C.green}`; color = C.greenDark }
                else if (opt === selected && !isCorrect) { bg = C.redLight; border = `2px solid ${C.red}`; color = C.red }
              } else if (opt === selected) { border = `2px solid ${C.blue}`; bg = '#E8F5FE' }
              return <button key={i} onClick={() => selectAnswer(opt)} style={{ width: '100%', padding: '14px 16px', textAlign: 'left', background: bg, border, borderRadius: 14, color, fontWeight: 600, fontSize: 14, cursor: showFeedback ? 'default' : 'pointer', lineHeight: 1.4 }}>{opt}</button>
            })}
          </div>
          {showFeedback && (
            <div style={{ background: isCorrect ? C.greenLight : C.redLight, padding: 16, borderRadius: 16, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>{isCorrect ? '✅' : '❌'}</span>
                <span style={{ fontWeight: 800, color: isCorrect ? C.greenDark : C.red, fontSize: 16 }}>{isCorrect ? 'Correct!' : 'Not quite!'}</span>
              </div>
              {isCorrect ? (
                <p style={{ margin: '0 0 12px', fontSize: 13, color: C.greenDark }}>Nice work! This word will come back for review later.</p>
              ) : (
                <div><p style={{ margin: '0 0 4px', color: C.red, fontSize: 13 }}><strong>{q.word}</strong> means: {data.definition}</p><p style={{ margin: '0 0 12px', fontSize: 13, color: C.red }}>You'll see this word again soon.</p></div>
              )}
              <button onClick={continueQuiz} style={{ width: '100%', padding: '14px 0', background: isCorrect ? C.green : C.red, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, cursor: 'pointer' }}>Continue</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── PRACTICE ──
  if (phase === 'practice') {
    const word = practiceWords[practiceIndex]
    const data = getWordData(word)
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0' }}>
          <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={finishPractice} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 13 }}>Skip →</button>
            <div style={{ flex: 1, height: 12, background: '#E5E5E5', borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${((practiceIndex + 1) / practiceWords.length) * 100}%`, background: C.orange, borderRadius: 6, transition: 'width 0.3s' }} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.gray }}>{practiceIndex + 1} / {practiceWords.length}</span>
          </div>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>💪</span><span style={{ color: C.orange, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Practice Difficult Words</span>
          </div>
          <p style={{ color: C.gray, fontSize: 13, margin: '0 0 20px' }}>Card {practiceIndex + 1} of {practiceWords.length} · Tap to flip</p>
          <div onClick={() => setPracticeFlipped(!practiceFlipped)} style={{ width: '100%', maxWidth: 340, height: 260, cursor: 'pointer', perspective: 1000 }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', transition: 'transform 0.5s', transformStyle: 'preserve-3d', transform: practiceFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', background: 'white', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: `2px solid ${C.orange}` }}>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: C.grayDark, margin: '0 0 16px' }}>{word}</h2>
                <p style={{ color: C.gray, textAlign: 'center', fontStyle: 'italic', fontSize: 15, lineHeight: 1.5 }}>"{data.sentence}"</p>
                <p style={{ color: '#D0D0D0', fontSize: 12, marginTop: 16 }}>Tap to see definition →</p>
              </div>
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: `linear-gradient(135deg, ${C.orange}, #E07800)`, borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', margin: '0 0 12px' }}>{word}</h2>
                <p style={{ color: 'white', textAlign: 'center', fontSize: 17, lineHeight: 1.5 }}>{data.definition}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={() => { setPracticeIndex(Math.max(0, practiceIndex - 1)); setPracticeFlipped(false) }} disabled={practiceIndex === 0}
              style={{ padding: '12px 24px', borderRadius: 14, fontWeight: 700, fontSize: 14, border: practiceIndex === 0 ? 'none' : `2px solid ${C.orange}`, background: practiceIndex === 0 ? '#E5E5E5' : 'white', color: practiceIndex === 0 ? C.gray : C.orange, cursor: practiceIndex === 0 ? 'default' : 'pointer' }}>← Back</button>
            {practiceIndex < practiceWords.length - 1 ? (
              <button onClick={() => { setPracticeIndex(practiceIndex + 1); setPracticeFlipped(false) }} style={{ padding: '12px 24px', borderRadius: 14, fontWeight: 700, fontSize: 14, border: 'none', background: C.orange, color: 'white', boxShadow: '0 4px 0 #E07800', cursor: 'pointer' }}>Next →</button>
            ) : (
              <button onClick={finishPractice} style={{ padding: '12px 24px', borderRadius: 14, fontWeight: 700, fontSize: 14, border: 'none', background: C.green, color: 'white', boxShadow: `0 4px 0 ${C.greenDark}`, cursor: 'pointer' }}>Done! ✓</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── CELEBRATION ──
  if (phase === 'celebration') {
    const correctCount = results.filter(r => r.wasCorrect).length
    const total = results.length
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 100
    const stats = getStats(localIntroduced, localCards)

    // Compute expected streak (profile prop may be stale before refresh completes)
    const today = getToday()
    const alreadyDoneToday = profile.today_complete && profile.last_session_date === today
    const displayStreak = alreadyDoneToday ? profile.streak : (profile.last_session_date !== today ? profile.streak + 1 : profile.streak)

    return (
      <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${C.greenLight} 0%, ${C.bg} 40%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <CatMascot size={110} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 4 }}>
          <FlameIcon size={36} active />
          <span style={{ fontSize: 42, fontWeight: 900, color: '#FF9600' }}>{displayStreak}</span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.grayDark, margin: '0 0 4px' }}>
          {isSprint ? 'Extra practice done! 💪' : displayStreak === 1 ? 'Day 1 — great start!' : displayStreak < 7 ? `${displayStreak}-day streak!` : `${displayStreak}-day streak! 🔥`}
        </h2>
        <p style={{ color: C.gray, margin: '0 0 24px', fontSize: 14 }}>
          {isSprint ? 'Great effort! Keep building that knowledge.' : displayStreak >= 7 ? "You're on fire! Keep it going!" : 'Come back tomorrow to keep your streak alive!'}
        </p>

        <div style={{ width: '100%', maxWidth: 340, background: 'white', borderRadius: 20, border: '2px solid #F0F0F0', padding: 16, marginBottom: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: C.grayDark, margin: '0 0 12px' }}>{isSprint ? 'Practice Summary' : "Today's Summary"}</p>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 800, color: C.blue }}>{sessionNewWords.length}</div><div style={{ fontSize: 11, color: C.gray }}>New Words</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 800, color: pct >= 80 ? C.green : C.orange }}>{pct}%</div><div style={{ fontSize: 11, color: C.gray }}>Quiz Score</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{stats.mastered}</div><div style={{ fontSize: 11, color: C.gray }}>Mastered</div></div>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => onComplete('done')} style={{ width: '100%', padding: '16px 0', background: C.green, color: 'white', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}` }}>Done for Today! 🎉</button>
          {(stats.learning + stats.review > 0 || (VOCABULARY.length - stats.totalIntroduced > 0)) && (
            <button onClick={() => { onComplete('sprint') }} style={{ width: '100%', padding: '16px 0', background: 'white', color: C.purple, fontWeight: 700, fontSize: 15, border: `2px solid ${C.purple}`, borderRadius: 16, cursor: 'pointer' }}>Keep Practicing 💪</button>
          )}
        </div>
      </div>
    )
  }

  return null
}

// ═══════════════════════════════════════════════════════════════
// WORD LIST
// ═══════════════════════════════════════════════════════════════
function WordListScreen({ profile, srsCards, onBack }) {
  const [tab, setTab] = useState('all')
  const introduced = profile.words_introduced || []
  const allWords = introduced.filter(w => srsCards[w])
  const learning = allWords.filter(w => srsCards[w]?.status === 'learning' || srsCards[w]?.status === 'new')
  const reviewing = allWords.filter(w => srsCards[w]?.status === 'review')
  const mastered = allWords.filter(w => srsCards[w]?.status === 'mastered')
  const tabs = [
    { id: 'all', label: 'All', count: allWords.length, color: C.blue },
    { id: 'learning', label: 'Learning', count: learning.length, color: C.orange },
    { id: 'review', label: 'Reviewing', count: reviewing.length, color: C.purple },
    { id: 'mastered', label: 'Mastered', count: mastered.length, color: C.green },
  ]
  const currentWords = tab === 'all' ? allWords : tab === 'learning' ? learning : tab === 'review' ? reviewing : mastered
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20 }}>✕</button>
        <span style={{ fontWeight: 700, color: C.grayDark, fontSize: 17 }}>My Words</span>
      </div>
      <div style={{ background: 'white', borderBottom: '2px solid #F0F0F0', overflowX: 'auto' }}>
        <div style={{ display: 'flex', maxWidth: 400, margin: '0 auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '12px 8px', background: 'none', border: 'none', borderBottom: tab === t.id ? `3px solid ${t.color}` : '3px solid transparent', color: tab === t.id ? t.color : C.gray, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{t.label} ({t.count})</button>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: 16 }}>
        {currentWords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}><CatMascot size={80} /><p style={{ color: C.gray, marginTop: 12 }}>No words here yet!</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentWords.map(word => {
              const c = srsCards[word]
              const data = getWordData(word)
              return (
                <div key={word} style={{ background: 'white', borderRadius: 16, padding: '14px 16px', border: '2px solid #F0F0F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: C.grayDark, margin: 0 }}>{word}</h3>
                    {c && <SRSBadge interval={c.interval} status={c.status} />}
                  </div>
                  <p style={{ color: C.gray, fontSize: 13, margin: '4px 0 0', lineHeight: 1.4 }}>{data.definition}</p>
                  {c && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}><StrengthBars repetition={c.repetition} size={16} /><span style={{ fontSize: 11, color: C.gray }}>{c.repetition} correct in a row</span></div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// FLASHCARD BROWSER — flip through words by category
// ═══════════════════════════════════════════════════════════════
function FlashcardBrowser({ title, words, srsCards, color, onBack }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (words.length === 0) return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20 }}>←</button>
        <span style={{ fontWeight: 700, color: C.grayDark, fontSize: 17 }}>{title}</span>
      </div>
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <CatMascot size={80} />
        <p style={{ color: C.gray, marginTop: 16, fontSize: 15 }}>No words in this category yet!</p>
        <button onClick={onBack} style={{ marginTop: 16, padding: '12px 28px', background: color, color: 'white', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 14, cursor: 'pointer' }}>Go Back</button>
      </div>
    </div>
  )

  const word = words[index]
  const data = getWordData(word)
  const card = srsCards[word]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0' }}>
        <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20 }}>←</button>
          <div style={{ flex: 1, height: 12, background: '#E5E5E5', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((index + 1) / words.length) * 100}%`, background: color, borderRadius: 6, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.gray }}>{index + 1} / {words.length}</span>
        </div>
      </div>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ color, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <p style={{ color: C.gray, fontSize: 13, margin: 0 }}>Tap card to flip</p>
          {card && <SRSBadge interval={card.interval} status={card.status} />}
        </div>
        <div onClick={() => setFlipped(!flipped)} style={{ width: '100%', maxWidth: 340, height: 280, cursor: 'pointer', perspective: 1000 }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', transition: 'transform 0.5s', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', background: 'white', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: `2px solid ${color}30` }}>
              <h2 style={{ fontSize: 30, fontWeight: 800, color: C.grayDark, margin: '0 0 16px' }}>{word}</h2>
              <p style={{ color: C.gray, textAlign: 'center', fontStyle: 'italic', fontSize: 15, lineHeight: 1.6 }}>"{data.sentence}"</p>
              <p style={{ color: '#D0D0D0', fontSize: 12, marginTop: 16 }}>Tap to see definition →</p>
            </div>
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: `linear-gradient(135deg, ${color}, ${color}CC)`, borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 12px' }}>{word}</h2>
              <p style={{ color: 'rgba(255,255,255,0.95)', textAlign: 'center', fontSize: 18, lineHeight: 1.5 }}>{data.definition}</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={() => { setIndex(Math.max(0, index - 1)); setFlipped(false) }} disabled={index === 0}
            style={{ padding: '12px 28px', borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: index === 0 ? 'default' : 'pointer', border: index === 0 ? 'none' : `2px solid ${color}`, background: index === 0 ? '#E5E5E5' : 'white', color: index === 0 ? C.gray : color }}>← Prev</button>
          <button onClick={() => { setIndex(Math.min(words.length - 1, index + 1)); setFlipped(false) }} disabled={index === words.length - 1}
            style={{ padding: '12px 28px', borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: index === words.length - 1 ? 'default' : 'pointer', border: 'none', background: index === words.length - 1 ? '#E5E5E5' : color, color: index === words.length - 1 ? C.gray : 'white', boxShadow: index === words.length - 1 ? 'none' : `0 4px 0 ${color}CC` }}>Next →</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [srsCards, setSrsCards] = useState({})
  const [screen, setScreen] = useState('loading') // loading | login | home | session | words | browse
  const [isSprint, setIsSprint] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)
  const [browseCategory, setBrowseCategory] = useState(null) // { title, words, color }

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user)
        loadUserData(session.user.id)
      } else {
        setScreen('login')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setAuthUser(null)
        setProfile(null)
        setSrsCards({})
        setScreen('login')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (userId, changeScreen = true) => {
    try {
      const [prof, cards] = await Promise.all([getProfile(userId), getSRSCards(userId)])
      if (prof) {
        // Check if streak should break (only on initial load / new day)
        const today = getToday()
        if (changeScreen && prof.last_session_date && prof.last_session_date !== today) {
          const last = new Date(prof.last_session_date)
          const now = new Date(today)
          const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24))
          if (diffDays === 1 && prof.today_complete) {
            // Completed yesterday, streak intact
          } else if (diffDays > 1) {
            prof.streak = 0
          } else if (!prof.today_complete) {
            prof.streak = 0
          }
          prof.today_complete = false
          prof.sprints_today = 0
          await updateProfile(userId, { streak: prof.streak, today_complete: false, sprints_today: 0 })
        }
        setProfile(prof)
        setSrsCards(cards)
        if (changeScreen) setScreen('home')
      } else {
        // Profile doesn't exist yet (edge case)
        const name = authUser?.user_metadata?.name || 'Student'
        const newProf = await createProfile(userId, name)
        setProfile(newProf)
        setSrsCards({})
        if (changeScreen) setScreen('home')
      }
    } catch (e) {
      console.error('Load error:', e)
      if (changeScreen) setScreen('login')
    }
  }

  const handleAuthComplete = async (user) => {
    setAuthUser(user)
    await loadUserData(user.id, true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setAuthUser(null)
    setProfile(null)
    setSrsCards({})
    setScreen('login')
  }

  const handleRefreshData = async () => {
    if (authUser) await loadUserData(authUser.id, false)
  }

  const startSession = (sprint) => {
    setIsSprint(sprint)
    setSessionKey(k => k + 1)
    setScreen('session')
  }

  if (screen === 'loading') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <CatMascot size={120} style={{ marginBottom: 16 }} /><Spinner text="Loading..." />
    </div>
  )

  if (screen === 'login') return <LoginScreen onAuthComplete={handleAuthComplete} />

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <CatMascot size={120} style={{ marginBottom: 16 }} /><Spinner text="Loading your progress..." />
    </div>
  )

  if (screen === 'session') return (
    <DailySession
      key={sessionKey}
      userId={authUser.id}
      profile={profile}
      srsCards={srsCards}
      isSprint={isSprint}
      onSave={handleRefreshData}
      onComplete={(action) => { handleRefreshData().then(() => { if (action === 'sprint') { setIsSprint(true); setSessionKey(k => k + 1); setScreen('session') } else { setScreen('home') } }) }}
    />
  )

  if (screen === 'words') return <WordListScreen profile={profile} srsCards={srsCards} onBack={() => setScreen('home')} />

  if (screen === 'browse' && browseCategory) return (
    <FlashcardBrowser
      title={browseCategory.title}
      words={browseCategory.words}
      srsCards={srsCards}
      color={browseCategory.color}
      onBack={() => setScreen('home')}
    />
  )

  return (
    <HomeScreen
      profile={profile}
      srsCards={srsCards}
      onStartSession={startSession}
      onViewWords={() => setScreen('words')}
      onLogout={handleLogout}
      onBrowse={(cat) => { setBrowseCategory(cat); setScreen('browse') }}
    />
  )
}
