import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './lib/supabase.js'
import { getProfile, updateProfile, createProfile, getSRSCards, upsertSRSCards } from './lib/db.js'
import { getToday, createSRSCard, updateSRSCard, isDueForReview, getIntervalLabel, buildDailySession, getStats } from './lib/srs.js'
import VOCABULARY from './data/words.json'

// ═══════════════════════════════════════════════════════════════
// CAT MASCOT (inline SVG)
// ═══════════════════════════════════════════════════════════════
const CatMascot = ({ size = 120, style = {} }) => (
  <svg width={size} height={size * 1.25} viewBox="0 0 20 25" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <path d="M10.31 3.57c.36.05.71.11 1.06.18.41-1.02.83-2.03 1.25-3.05.25 0 .5-.01.74-.01 1.17 0 2.34 0 3.5.01.24.63.49 1.26.74 1.89.18.47.36.94.55 1.41.49.73.97 1.45 1.45 2.18-1.12 3.22-2.24 6.44-3.36 9.65-.18 1.21-.36 2.42-.55 3.62-.39 2.53-.79 5.06-1.19 7.59.44.25.87.51 1.31.76 1.03.6 2.06 1.2 3.09 1.79-.3.32-.59.63-.89.95-.72.77-1.43 1.55-2.15 2.32-.55.35-1.11.71-1.66 1.06-.77.49-1.53.98-2.3 1.47-.29.05-.58.09-.87.14-.47.08-.93.16-1.4.24-.22-.11-.44-.21-.66-.32-.64-.31-1.28-.62-1.91-.93-1.67-.82-3.34-1.63-5-2.45-.22-.03-.45-.06-.67-.09-.63-.08-1.26-.16-1.89-.24-.62-.21-1.23-.43-1.85-.64-1.15-.39-2.29-.79-3.44-1.18.29-.81.58-1.62.86-2.43.41-1.14.82-2.27 1.23-3.41.39-1.07.78-2.15 1.17-3.22.51-1.41 1.02-2.82 1.52-4.24 1.16-3.21 2.31-6.43 3.47-9.64.47-.7.93-1.41 1.4-2.11.18-.45.36-.9.55-1.35.25-.61.5-1.23.75-1.84 1.17 0 2.33 0 3.5-.01.24 0 .48 0 .72.01.41.98.82 1.97 1.23 2.95.35-.05.69-.11 1.04-.16z" fill="#b88652"/>
    <path d="M10.65 24.57c.45-.07.91-.14 1.36-.21.3-.05.59-.09.89-.14-.37-.35-.74-.71-1.11-1.06-.44-.42-.87-.84-1.31-1.27-.35-.2-.7-.4-1.04-.6-1.07-.62-2.14-1.24-3.2-1.86-.43-.25-.86-.51-1.29-.76.39-2.53.78-5.05 1.18-7.58.18-1.19.37-2.37.55-3.56 1.09-3.13 2.18-6.26 3.27-9.39-.5-.76-1-1.51-1.51-2.27-.18-.45-.36-.9-.54-1.35-.25-.63-.5-1.26-.74-1.89-1.17 0-2.34 0-3.5-.01-.24 0-.49 0-.73.01-.41.97-.82 1.93-1.23 2.9-.37-.05-.74-.1-1.12-.16-.35-.05-.71-.11-1.06-.17-.41.98-.82 1.96-1.23 2.95-.24 0-.48 0-.72-.01-1.17.01-2.33.01-3.5.01-.25.61-.5 1.23-.75 1.84-.18.45-.36.9-.55 1.35-.47.7-.93 1.41-1.4 2.11-1.16 3.21-2.31 6.43-3.47 9.64-.5 1.41-1.01 2.83-1.52 4.24-.39 1.07-.78 2.15-1.17 3.22-.41 1.14-.82 2.27-1.23 3.41-.29.81-.58 1.62-.86 2.43 1.15.39 2.29.79 3.44 1.18.62.21 1.23.43 1.85.64.63.08 1.26.16 1.89.24.22.03.45.06.67.09 1.67.82 3.34 1.63 5 2.45.64.31 1.28.62 1.91.93.22.11.44.21.66.32.47-.08.93-.16 1.4-.24z" fill="#784d30"/>
    <path d="M6.59 20.85c-.21.04-.43.08-.64.12-1.59.29-3.18.58-4.77.86-1.1.2-2.19.4-3.29.59.21-.45.42-.89.64-1.34.58-1.22 1.16-2.45 1.74-3.67.29-.62.58-1.24.87-1.86 1.04.04 2.08.08 3.13.11 1.45.05 2.91.1 4.36.15.1.01.2.01.3.02-.07 1.16-.13 2.32-.2 3.48-.06 1.14-.13 2.27-.19 3.41-.66-.63-1.33-1.26-1.99-1.88.01-.01.02-.01.03-.02z" fill="#e0c399"/>
    <path d="M13.41 20.85c-.01-.01-.02-.01-.03-.02.66-.63 1.33-1.26 1.99-1.88.06 1.14.13 2.27.19 3.41.07 1.16.13 2.32.2 3.48.1.01.2.01.3.02 1.45.05 2.91.1 4.36.15 1.04.04 2.08.08 3.13.11.29-.62.58-1.24.87-1.86.58-1.22 1.16-2.45 1.74-3.67.21-.45.42-.89.64-1.34-1.1.2-2.19.4-3.29.59-1.59.29-3.18.58-4.77.86-.21.04-.43.08-.64.12z" fill="#e0c399"/>
    <ellipse cx="6.59" cy="8.75" rx="1.74" ry="1.88" fill="#7eb866"/>
    <ellipse cx="13.41" cy="8.75" rx="1.74" ry="1.88" fill="#7eb866"/>
    <ellipse cx="6.59" cy="8.75" rx="0.87" ry="1.88" fill="#000000"/>
    <ellipse cx="13.41" cy="8.75" rx="0.87" ry="1.88" fill="#000000"/>
    <circle cx="6.16" cy="7.97" r="0.43" fill="#ffffff"/>
    <circle cx="13.84" cy="7.97" r="0.43" fill="#ffffff"/>
    <path d="M10 11.51c-.24 0-.48-.02-.72-.06-.24.04-.48.06-.72.06-.26 0-.51-.02-.76-.07-.03-.28-.06-.55-.09-.83.25-.04.5-.07.76-.1.27 0 .54.01.81.03.27-.02.54-.03.81-.03.25.03.5.06.76.1-.03.28-.06.55-.09.83-.25.05-.5.07-.76.07z" fill="#e8a2a2"/>
    <path d="M10 13.75c-.36.18-.72.36-1.09.54-.22-1.19-.43-2.38-.65-3.57-.25 1.39-.5 2.78-.76 4.17.77-.38 1.54-.76 2.3-1.14.76.38 1.53.76 2.3 1.14-.25-1.39-.5-2.78-.76-4.17-.22 1.19-.43 2.38-.65 3.57-.36-.18-.72-.36-1.09-.54z" fill="#e0c399"/>
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
// CONFETTI BURST
// ═══════════════════════════════════════════════════════════════
function ConfettiBurst({ active }) {
  const [particles, setParticles] = useState([])
  useEffect(() => {
    if (!active) return
    const colors = ['#58CC02', '#CE82FF', '#FF9600', '#1CB0F6', '#FF4B4B', '#FFD700', '#FF6B9D']
    const newParticles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 10,
      y: 40,
      angle: Math.random() * 360,
      speed: 3 + Math.random() * 6,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 15,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 6,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }))
    setParticles(newParticles)
    const timer = setTimeout(() => setParticles([]), 2000)
    return () => clearTimeout(timer)
  }, [active])

  if (particles.length === 0) return null
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translate(0, 0) rotate(var(--rot-start)); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot-end)); opacity: 0; }
        }
      `}</style>
      {particles.map(p => {
        const rad = (p.angle * Math.PI) / 180
        const dx = Math.cos(rad) * p.speed * 60
        const dy = Math.sin(rad) * p.speed * 40 + 200
        return (
          <div key={p.id} style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.shape === 'rect' ? p.size * 0.6 : p.size,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            background: p.color,
            '--dx': `${dx}px`,
            '--dy': `${dy}px`,
            '--rot-start': `${p.rotation}deg`,
            '--rot-end': `${p.rotation + p.rotSpeed * 100}deg`,
            animation: 'confetti-fall 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
          }} />
        )
      })}
    </div>
  )
}

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
// WELCOME PANEL (shown once for first-time users)
// ═══════════════════════════════════════════════════════════════
function WelcomePanel({ name, onDismiss, isFirstTime }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <div style={{ marginTop: 16 }}><CatMascot size={80} /></div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.grayDark, margin: '20px 0 8px' }}>
          {isFirstTime ? `Welcome, ${name}! 🎉` : 'How It Works'}
        </h1>
        <p style={{ color: C.gray, fontSize: 15, margin: '0 0 28px', lineHeight: 1.5 }}>
          Your mission: master all <strong>1,000 SAT words</strong>. Here's how it works:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28, textAlign: 'left' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '2px solid #F0F0F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>📚</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.orange }}>Learning</span>
            </div>
            <p style={{ color: C.gray, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              New words start here. You'll see them on flashcards, then answer a quiz. Get one wrong? It stays here until you nail it.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18, color: C.gray }}>↓ get it right once</span>
          </div>

          <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '2px solid #F0F0F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>🔄</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.purple }}>Reviewing</span>
            </div>
            <p style={{ color: C.gray, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              Almost there! These are words you've gotten right once. One more correct answer and they're mastered.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18, color: C.gray }}>↓ get it right again</span>
          </div>

          <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '2px solid #F0F0F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>⭐</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.green }}>Mastered</span>
            </div>
            <p style={{ color: C.gray, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              You know it! Two correct answers in a row means this word is yours. Keep going until all 1,000 are here!
            </p>
          </div>
        </div>

        <p style={{ color: C.gray, fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
          You'll learn <strong>5 new words</strong> each day. Build a streak, and before you know it, you'll be an SAT vocab pro! 🐱
        </p>

        <button onClick={onDismiss} style={{ width: '100%', padding: '18px 0', background: C.green, color: 'white', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}` }}>
          {isFirstTime ? "Let's Get Started! 🚀" : 'Got it! ✓'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════
function HomeScreen({ profile, srsCards, onStartSession, onStartReviewQuiz, onStartLearningQuiz, onStartMasteredQuiz, onViewWords, onLogout, onBrowse, onShowHowItWorks }) {
  const stats = getStats(profile.words_introduced, srsCards)
  const today = getToday()
  const dayDone = profile.today_complete && profile.last_session_date === today

  const introduced = profile.words_introduced || []
  const learningWords = introduced.filter(w => {
    const c = srsCards[w]; if (!c) return false
    return (parseInt(c.repetition, 10) || 0) === 0
  })
  const reviewingWords = introduced.filter(w => {
    const c = srsCards[w]; if (!c) return false
    return (parseInt(c.repetition, 10) || 0) === 1
  })
  const masteredWords = introduced.filter(w => {
    const c = srsCards[w]; if (!c) return false
    return (parseInt(c.repetition, 10) || 0) >= 2
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onShowHowItWorks} style={{ background: 'none', border: 'none', color: C.blue, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>How it works</button>
        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: C.gray, cursor: 'pointer', fontSize: 13 }}>Sign Out</button>
      </div>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <CatMascot size={80} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.grayDark, margin: '12px 0 4px' }}>
            {dayDone ? '🎉 Day complete!' : `Hey, ${profile.name}!`}
          </h2>
          <p style={{ color: C.gray, margin: 0, fontSize: 14 }}>
            {dayDone ? 'Great work today. See you tomorrow!' : "Complete today's session to keep your streak."}
          </p>
        </div>

        {/* Streak — prominent center display */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'white', padding: '16px 32px', borderRadius: 20, border: '2px solid #F0F0F0' }}>
            <FlameIcon size={36} active={profile.streak > 0} />
            <div>
              <div style={{ fontSize: 36, fontWeight: 900, color: profile.streak > 0 ? '#FF9600' : C.gray, lineHeight: 1 }}>{profile.streak}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, marginTop: 2 }}>day streak{profile.best_streak > 1 ? ` · Best: ${profile.best_streak}` : ''}</div>
            </div>
          </div>
          {dayDone && profile.sprints_today > 0 && <p style={{ color: C.purple, margin: '8px 0 0', fontSize: 13, fontWeight: 600 }}>+{profile.sprints_today * 5} extra practice words today!</p>}
        </div>

        {/* Stat panels */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {/* Learning panel */}
          <div style={{ flex: 1, background: 'white', borderRadius: 16, padding: '14px 12px', border: '2px solid #F0F0F0' }}>
            <div onClick={() => learningWords.length > 0 && onBrowse({ title: 'Learning', words: learningWords, color: C.orange })}
              style={{ cursor: learningWords.length > 0 ? 'pointer' : 'default' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.orange, textAlign: 'center' }}>{stats.learning}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.grayDark, textAlign: 'center', marginTop: 2 }}>Learning</div>
              <p style={{ fontSize: 11, color: C.gray, textAlign: 'center', margin: '6px 0 0', lineHeight: 1.3 }}>Words you've gotten wrong</p>
            </div>
            {stats.learning > 0 && (
              <button onClick={onStartLearningQuiz}
                style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: C.orange, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Practice them →</button>
            )}
          </div>
          {/* Reviewing panel */}
          <div style={{ flex: 1, background: 'white', borderRadius: 16, padding: '14px 12px', border: '2px solid #F0F0F0' }}>
            <div onClick={() => reviewingWords.length > 0 && onBrowse({ title: 'Reviewing', words: reviewingWords, color: C.purple })}
              style={{ cursor: reviewingWords.length > 0 ? 'pointer' : 'default' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.purple, textAlign: 'center' }}>{stats.review}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.grayDark, textAlign: 'center', marginTop: 2 }}>Reviewing</div>
              <p style={{ fontSize: 11, color: C.gray, textAlign: 'center', margin: '6px 0 0', lineHeight: 1.3 }}>Words you've gotten right once</p>
            </div>
            {stats.review > 0 && (
              <button onClick={onStartReviewQuiz}
                style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: C.purple, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Master them →</button>
            )}
          </div>
        </div>

        {/* Mastered count card */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '2px solid #F0F0F0', marginBottom: 20, textAlign: 'center' }}>
          <div onClick={() => stats.mastered > 0 && onBrowse({ title: 'Mastered', words: masteredWords, color: C.green })}
            style={{ cursor: stats.mastered > 0 ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.green }}>{stats.mastered} <span style={{ fontSize: 28, fontWeight: 800, color: C.gray }}>/ {VOCABULARY.length}</span></div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.grayDark, marginTop: 4 }}>Words Mastered</div>
          </div>
          {stats.mastered === 0 && (
            <p style={{ color: C.gray, fontSize: 12, margin: '8px 0 0', lineHeight: 1.4 }}>Get a word right twice in a row to master it.</p>
          )}
          {stats.mastered > 0 && (
            <button onClick={onStartMasteredQuiz}
              style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: C.green, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Quiz yourself →</button>
          )}
        </div>

        {!dayDone ? (
          <button onClick={() => onStartSession(false)} style={{ width: '100%', padding: '18px 0', background: C.green, color: 'white', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}` }}>Start Today's Session</button>
        ) : (
          <button onClick={() => onStartSession(true)} style={{ width: '100%', padding: '16px 0', background: C.purple, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: '0 4px 0 #A855F7' }}>Keep Practicing 💪</button>
        )}
        <button onClick={onViewWords} style={{ width: '100%', padding: '14px 0', background: 'transparent', color: C.gray, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', marginTop: 8 }}>View All Words</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DAILY SESSION — Learn → Quiz → Practice → Celebration
// ═══════════════════════════════════════════════════════════════
function DailySession({ userId, profile, srsCards, onComplete, onSave, isSprint, initialMode }) {
  const [phase, setPhase] = useState('init')
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [quizWords, setQuizWords] = useState([])
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [results, setResults] = useState([])
  const [sessionNewWords, setSessionNewWords] = useState([])
  const [sessionReviewWords, setSessionReviewWords] = useState([])
  const [isReviewQuiz, setIsReviewQuiz] = useState(initialMode === 'reviewQuiz' || initialMode === 'learningQuiz' || initialMode === 'masteredQuiz')
  const [confettiKey, setConfettiKey] = useState(0)

  // Local mutable copy of cards for this session
  const [localCards, setLocalCards] = useState({ ...srsCards })
  const [localIntroduced, setLocalIntroduced] = useState([...(profile.words_introduced || [])])

  useEffect(() => {
    if (initialMode === 'reviewQuiz') {
      const reviewWords = (localIntroduced || [])
        .filter(w => {
          const c = localCards[w]; if (!c) return false
          return (parseInt(c.repetition, 10) || 0) === 1
        })
      console.log(`[ReviewQuiz] Found ${reviewWords.length} words to review`)
      setSessionNewWords([])
      setSessionReviewWords(reviewWords)
      if (reviewWords.length > 0) buildAndStartQuiz([], reviewWords)
      else setPhase('celebration')
    } else if (initialMode === 'masteredQuiz') {
      // Quiz mastered words — wrong answers go back to review (rep=1)
      const masteredWords = (localIntroduced || [])
        .filter(w => {
          const c = localCards[w]; if (!c) return false
          return (parseInt(c.repetition, 10) || 0) >= 2
        })
        .sort(() => Math.random() - 0.5) // shuffle
        .slice(0, 25) // max 25
      console.log(`[MasteredQuiz] Found ${masteredWords.length} mastered words to quiz`)
      setSessionNewWords([])
      setSessionReviewWords(masteredWords)
      if (masteredWords.length > 0) buildAndStartQuiz([], masteredWords)
      else setPhase('celebration')
    } else if (initialMode === 'learningQuiz') {
      const learningWords = (localIntroduced || [])
        .filter(w => {
          const c = localCards[w]; if (!c) return false
          return (parseInt(c.repetition, 10) || 0) === 0
        })
      console.log(`[LearningQuiz] Found ${learningWords.length} words to practice`)
      setSessionNewWords([])
      setSessionReviewWords(learningWords)
      if (learningWords.length > 0) buildAndStartQuiz([], learningWords)
      else setPhase('celebration')
    } else {
      const session = buildDailySession(localIntroduced, localCards, VOCABULARY)
      setSessionNewWords(session.newWords)
      setSessionReviewWords(session.reviewWords)
      if (session.newWords.length > 0) setPhase('learn')
      else if (session.newWords.length + session.reviewWords.length > 0) buildAndStartQuiz(session.newWords, session.reviewWords)
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

  const selectAnswer = (ans) => {
    if (showFeedback) return
    setSelected(ans)
    setShowFeedback(true)
    // Check if this answer masters the word
    const q = quizWords[qIndex]
    const correctDef = getWordData(q.word).definition
    if (ans === correctDef) {
      const existCard = localCards[q.word]
      const existRep = existCard ? (parseInt(existCard.repetition, 10) || 0) : 0
      if (existRep >= 1) {
        setConfettiKey(k => k + 1) // trigger confetti!
      }
    }
  }

  const continueQuiz = () => {
    const w = quizWords[qIndex]
    const correctDef = getWordData(w.word).definition
    const wasCorrect = selected === correctDef
    const existing = localCards[w.word] || createSRSCard(w.word)
    console.log(`[Quiz] ${w.word}: existing rep=${existing.repetition} status=${existing.status}`)
    let updated = updateSRSCard(existing, wasCorrect)
    // In mastered quiz, wrong answers go back to review (rep=1) not learning (rep=0)
    if (initialMode === 'masteredQuiz' && !wasCorrect) {
      updated = { ...updated, repetition: 1, status: 'review' }
      console.log(`[MasteredQuiz] ${w.word}: demoted to review (rep=1)`)
    }
    console.log(`[Quiz] ${w.word}: updated rep=${updated.repetition} status=${updated.status}`)

    // Update localCards immediately so progress is tracked per-answer
    const updatedCards = { ...localCards, [w.word]: updated }
    setLocalCards(updatedCards)

    const newResults = [...results, { word: w.word, wasCorrect, newCard: updated }]
    if (qIndex < quizWords.length - 1) {
      setResults(newResults); setQIndex(qIndex + 1); setSelected(null); setShowFeedback(false)
    } else {
      finishQuiz(newResults)
    }
  }

  // Save progress and exit when user quits mid-quiz
  const handleQuitQuiz = async () => {
    let allResults = [...results]
    let cardsToSave = { ...localCards }
    let introducedToSave = [...localIntroduced]

    // If feedback is showing, the current answer hasn't been processed yet — include it
    if (showFeedback && quizWords[qIndex]) {
      const w = quizWords[qIndex]
      const correctDef = getWordData(w.word).definition
      const wasCorrect = selected === correctDef
      const existing = cardsToSave[w.word] || createSRSCard(w.word)
      let updated = updateSRSCard(existing, wasCorrect)
      if (initialMode === 'masteredQuiz' && !wasCorrect) {
        updated = { ...updated, repetition: 1, status: 'review' }
      }
      cardsToSave[w.word] = updated
      allResults.push({ word: w.word, wasCorrect, newCard: updated })
    }

    if (allResults.length > 0) {
      console.log(`[handleQuitQuiz] Saving ${allResults.length} partial results before exiting`)
      allResults.forEach(r => { if (!introducedToSave.includes(r.word)) introducedToSave.push(r.word) })
      await saveToDB(cardsToSave, introducedToSave, false, allResults)
    }
    onComplete()
  }

  const finishQuiz = async (quizResults) => {
    const newCards = { ...localCards }
    const newIntroduced = [...localIntroduced]
    quizResults.forEach(r => { newCards[r.word] = r.newCard; if (!newIntroduced.includes(r.word)) newIntroduced.push(r.word) })
    sessionNewWords.forEach(w => { if (!newIntroduced.includes(w)) newIntroduced.push(w); if (!newCards[w]) newCards[w] = createSRSCard(w) })

    // Log final card states
    console.log('[finishQuiz] Card states being saved:')
    quizResults.forEach(r => console.log(`  ${r.word}: rep=${r.newCard.repetition} status=${r.newCard.status} correct=${r.wasCorrect}`))

    setLocalCards(newCards)
    setLocalIntroduced(newIntroduced)
    setResults(quizResults)

    await completeDayAndSave(newCards, newIntroduced, quizResults)
    setPhase('celebration')
  }

  const saveToDB = async (cards, introduced, dayComplete, quizResults) => {
    try {
      // Save SRS cards — only save cards that have been touched
      const changedCards = {}
      Object.keys(cards).forEach(w => { if (cards[w]) changedCards[w] = cards[w] })
      console.log(`[saveToDB] Saving ${Object.keys(changedCards).length} cards to DB`)
      await upsertSRSCards(userId, changedCards)
      console.log('[saveToDB] Cards saved successfully')

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
            <span style={{ fontSize: 11, fontWeight: 700, color: C.gray }}>New word {cardIndex + 1} of {sessionNewWords.length}</span>
          </div>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ color: C.gray, fontSize: 13, margin: '0 0 20px' }}>Tap card to flip</p>
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
        <ConfettiBurst active={confettiKey} />
        <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0' }}>
          <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleQuitQuiz} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20 }}>✕</button>
            <div style={{ flex: 1, height: 12, background: '#E5E5E5', borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${((qIndex + 1) / quizWords.length) * 100}%`, background: C.green, borderRadius: 6, transition: 'width 0.3s' }} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.gray }}>{initialMode === 'learningQuiz' ? 'Practice' : initialMode === 'reviewQuiz' ? 'Review' : initialMode === 'masteredQuiz' ? 'Mastery Check' : 'Quiz'} {qIndex + 1} of {quizWords.length}</span>
          </div>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>✍️</span><p style={{ color: C.grayDark, fontWeight: 700, fontSize: 16, margin: 0 }}>What does this word mean?</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: C.blue, margin: 0 }}>{q.word}</h2>
            {initialMode === 'masteredQuiz' && <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: C.greenLight, color: C.green }}>MASTERED</span>}
            {isReview && initialMode !== 'masteredQuiz' && <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: C.purpleLight, color: C.purple }}>REVIEW</span>}
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
          {showFeedback && (() => {
            const existCard = localCards[q.word]
            const existRep = existCard ? (parseInt(existCard.repetition, 10) || 0) : 0
            const willMaster = isCorrect && existRep >= 1 && initialMode !== 'masteredQuiz'
            const isMasteredQuizWrong = !isCorrect && initialMode === 'masteredQuiz'
            return (
            <div style={{ background: isCorrect ? C.greenLight : C.redLight, padding: 16, borderRadius: 16, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>{isCorrect ? (willMaster ? '⭐' : '✅') : '❌'}</span>
                <span style={{ fontWeight: 800, color: isCorrect ? C.greenDark : C.red, fontSize: 16 }}>{isCorrect ? (willMaster ? 'Mastered!' : (initialMode === 'masteredQuiz' ? 'Still got it!' : 'Correct!')) : 'Not quite!'}</span>
              </div>
              {isCorrect ? (
                <p style={{ margin: '0 0 12px', fontSize: 13, color: C.greenDark }}>
                  {willMaster ? "That's two in a row — this word is now mastered! 🎉"
                    : initialMode === 'masteredQuiz' ? 'You know this one well!'
                    : 'Nice work! Get it right once more to master it.'}
                </p>
              ) : (
                <div>
                  <p style={{ margin: '0 0 4px', color: C.red, fontSize: 13 }}><strong>{q.word}</strong> means: {data.definition}</p>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: C.red }}>
                    {isMasteredQuizWrong ? "This word moves back to your review list." : "You'll see this word again soon."}
                  </p>
                </div>
              )}
              <button onClick={continueQuiz} style={{ width: '100%', padding: '14px 0', background: isCorrect ? C.green : C.red, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, cursor: 'pointer' }}>Continue</button>
            </div>
            )
          })()}
        </div>
      </div>
    )
  }

  // ── CELEBRATION ──
  if (phase === 'celebration') {
    const stats = getStats(localIntroduced, localCards)
    console.log(`[Celebration] Stats: learning=${stats.learning} review=${stats.review} mastered=${stats.mastered}`)

    // Compute expected streak (profile prop may be stale before refresh completes)
    const today = getToday()
    const alreadyDoneToday = profile.today_complete && profile.last_session_date === today
    const displayStreak = alreadyDoneToday ? profile.streak : (profile.last_session_date !== today ? profile.streak + 1 : profile.streak)

    return (
      <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${C.greenLight} 0%, ${C.bg} 40%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24 }}>
        <div style={{ marginTop: 16 }}>
          <CatMascot size={90} />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'white', padding: '16px 32px', borderRadius: 20, border: '2px solid #F0F0F0', marginTop: 16, marginBottom: 8 }}>
          <FlameIcon size={36} active />
          <div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#FF9600', lineHeight: 1 }}>{displayStreak}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, marginTop: 2 }}>day streak</div>
          </div>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.grayDark, margin: '8px 0 4px' }}>
          {isSprint ? 'Extra practice done! 💪' : displayStreak === 1 ? 'Day 1 — great start!' : displayStreak < 7 ? `${displayStreak}-day streak!` : `${displayStreak}-day streak! 🔥`}
        </h2>
        <p style={{ color: C.gray, margin: '0 0 24px', fontSize: 14 }}>
          {isSprint ? 'Great effort! Keep building that knowledge.' : displayStreak >= 7 ? "You're on fire! Keep it going!" : 'Come back tomorrow to keep your streak alive!'}
        </p>

        {/* Stat panels — same layout as home screen */}
        <div style={{ width: '100%', maxWidth: 340, display: 'flex', gap: 8, marginBottom: 16 }}>
          {/* Learning panel */}
          <div style={{ flex: 1, background: 'white', borderRadius: 16, padding: '14px 12px', border: '2px solid #F0F0F0' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.orange, textAlign: 'center' }}>{stats.learning}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.grayDark, textAlign: 'center', marginTop: 2 }}>Learning</div>
            <p style={{ fontSize: 11, color: C.gray, textAlign: 'center', margin: '6px 0 0', lineHeight: 1.3 }}>Words you've gotten wrong</p>
            {stats.learning > 0 && (
              <button onClick={() => onComplete('learningQuiz')}
                style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: C.orange, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Practice them →</button>
            )}
          </div>
          {/* Reviewing panel */}
          <div style={{ flex: 1, background: 'white', borderRadius: 16, padding: '14px 12px', border: '2px solid #F0F0F0' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.purple, textAlign: 'center' }}>{stats.review}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.grayDark, textAlign: 'center', marginTop: 2 }}>Reviewing</div>
            <p style={{ fontSize: 11, color: C.gray, textAlign: 'center', margin: '6px 0 0', lineHeight: 1.3 }}>Words you've gotten right once</p>
            {stats.review > 0 && (
              <button onClick={() => onComplete('reviewQuiz')}
                style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: C.purple, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Master them →</button>
            )}
          </div>
        </div>

        {/* Mastered count card */}
        <div style={{ width: '100%', maxWidth: 340, background: 'white', borderRadius: 16, padding: 16, border: '2px solid #F0F0F0', marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.green }}>{stats.mastered} <span style={{ fontSize: 28, fontWeight: 800, color: C.gray }}>/ {VOCABULARY.length}</span></div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.grayDark, marginTop: 4 }}>Words Mastered</div>
          {stats.mastered === 0 && (
            <p style={{ color: C.gray, fontSize: 12, margin: '8px 0 0', lineHeight: 1.4 }}>Get a word right twice in a row to master it.</p>
          )}
          {stats.mastered > 0 && (
            <button onClick={() => onComplete('masteredQuiz')}
              style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: C.green, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Quiz yourself →</button>
          )}
        </div>

        <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => onComplete('done')} style={{ width: '100%', padding: '16px 0', background: C.green, color: 'white', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}` }}>Done for Today! 🎉</button>
          {(VOCABULARY.length - stats.totalIntroduced > 0) && (
            <button onClick={() => { onComplete('sprint') }} style={{ width: '100%', padding: '16px 0', background: C.blue, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: `0 4px 0 ${C.blueDark}` }}>Learn More New Words</button>
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
  const learning = allWords.filter(w => (parseInt(srsCards[w]?.repetition, 10) || 0) === 0)
  const reviewing = allWords.filter(w => (parseInt(srsCards[w]?.repetition, 10) || 0) === 1)
  const mastered = allWords.filter(w => (parseInt(srsCards[w]?.repetition, 10) || 0) >= 2)
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
  const [sessionMode, setSessionMode] = useState('normal') // 'normal' | 'reviewQuiz' | 'learningQuiz'
  const [browseCategory, setBrowseCategory] = useState(null) // { title, words, color }
  const [showWelcome, setShowWelcome] = useState(false)

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
      console.log(`[loadUserData] Loaded ${Object.keys(cards).length} cards from DB`)
      // Log a sample of card states
      const cardList = Object.values(cards)
      if (cardList.length > 0) {
        cardList.slice(0, 10).forEach(c => console.log(`  ${c.word}: rep=${c.repetition} status=${c.status}`))
      }
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
        if (changeScreen) {
          if (prof.sessions_completed === 0 && (!prof.words_introduced || prof.words_introduced.length === 0)) {
            setShowWelcome('first')
          }
          setScreen('home')
        }
      } else {
        // Profile doesn't exist yet (edge case)
        const name = authUser?.user_metadata?.name || 'Student'
        const newProf = await createProfile(userId, name)
        setProfile(newProf)
        setSrsCards({})
        if (changeScreen) {
          setShowWelcome('first')
          setScreen('home')
        }
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
    // Periodic mastery review: every 5th session, if 10+ mastered words, do mastery quiz
    if (!sprint && profile) {
      const sessCount = profile.sessions_completed || 0
      const stats = getStats(profile.words_introduced || [], srsCards)
      if (sessCount > 0 && sessCount % 5 === 0 && stats.mastered >= 10) {
        console.log(`[MasteryReview] Session #${sessCount + 1}: triggering mastery review (${stats.mastered} mastered)`)
        setIsSprint(false) // counts as a real session
        setSessionMode('masteredQuiz')
        setSessionKey(k => k + 1)
        setScreen('session')
        return
      }
    }
    setIsSprint(sprint)
    setSessionMode('normal')
    setSessionKey(k => k + 1)
    setScreen('session')
  }

  const startReviewQuiz = () => {
    setIsSprint(true)
    setSessionMode('reviewQuiz')
    setSessionKey(k => k + 1)
    setScreen('session')
  }

  const startLearningQuiz = () => {
    setIsSprint(true)
    setSessionMode('learningQuiz')
    setSessionKey(k => k + 1)
    setScreen('session')
  }

  const startMasteredQuiz = () => {
    setIsSprint(true)
    setSessionMode('masteredQuiz')
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
      initialMode={sessionMode}
      onSave={handleRefreshData}
      onComplete={(action) => { handleRefreshData().then(() => {
        if (action === 'sprint') { setIsSprint(true); setSessionMode('normal'); setSessionKey(k => k + 1); setScreen('session') }
        else if (action === 'reviewQuiz') { startReviewQuiz() }
        else if (action === 'learningQuiz') { startLearningQuiz() }
        else if (action === 'masteredQuiz') { startMasteredQuiz() }
        else { setScreen('home') }
      }) }}
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

  if (showWelcome) return (
    <WelcomePanel
      name={profile.name}
      isFirstTime={showWelcome === 'first'}
      onDismiss={() => setShowWelcome(false)}
    />
  )

  return (
    <HomeScreen
      profile={profile}
      srsCards={srsCards}
      onStartSession={startSession}
      onStartReviewQuiz={startReviewQuiz}
      onStartLearningQuiz={startLearningQuiz}
      onStartMasteredQuiz={startMasteredQuiz}
      onViewWords={() => setScreen('words')}
      onLogout={handleLogout}
      onBrowse={(cat) => { setBrowseCategory(cat); setScreen('browse') }}
      onShowHowItWorks={() => setShowWelcome('howItWorks')}
    />
  )
}
