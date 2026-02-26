import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase.js'
import { getProfile, updateProfile, createProfile, getSRSCards, upsertSRSCards, searchUsers, getFollowing, followUser, unfollowUser, sendMessage, getMessages, getUnreadCount, markMessagesRead } from './lib/db.js'
import { getToday, createSRSCard, updateSRSCard, isDueForReview, getIntervalLabel, buildDailySession, getStats } from './lib/srs.js'
import VOCABULARY_RAW from './data/words.json'

// Deterministic shuffle so word order is mixed but consistent
function seededShuffle(arr, seed = 42) {
  const shuffled = [...arr]
  let s = seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647
    const j = s % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
const VOCABULARY = seededShuffle(VOCABULARY_RAW)

// ═══════════════════════════════════════════════════════════════
// CAT MASCOT (inline SVG)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════
const C = {
  green: '#58CC02', greenDark: '#4CAD00', greenLight: '#D7FFB8',
  blue: '#1CB0F6', blueDark: '#1899D6', blueLight: '#E8F5FE',
  orange: '#FF9600', orangeLight: '#FFF3E0',
  red: '#FF4B4B', redLight: '#FFE0E0',
  purple: '#CE82FF', purpleLight: '#F3E8FF',
  gold: '#F5A623', goldDark: '#D4911E', goldLight: '#FFF5E0',
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
    <path d="M12 2C12 2 4 10 4 15C4 19.4 7.6 22 12 22C16.4 22 20 19.4 20 15C20 10 12 2 12 2Z" fill={active ? '#FF4B4B' : '#E5E5E5'} />
    <path d="M12 8C12 8 8 13 8 16C8 18.8 9.8 20 12 20C14.2 20 16 18.8 16 16C16 13 12 8 12 8Z" fill={active ? '#FF7676' : '#AFAFAF'} />
  </svg>
)

const SRSBadge = ({ interval, status }) => {
  const colors = { new: { bg: '#E8F5FE', t: C.blue }, learning: { bg: C.blueLight, t: C.blue }, review: { bg: C.purpleLight, t: C.purple }, mastered: { bg: C.goldLight, t: C.gold } }
  const col = colors[status] || colors.new
  const label = status === 'mastered' ? '✓ Mastered' : status === 'new' ? 'New' : `Next: ${getIntervalLabel(interval)}`
  return <span style={{ padding: '3px 10px', background: col.bg, color: col.t, borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{label}</span>
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
// MINI CELEBRATIONS — varied animations for correct answers
// ═══════════════════════════════════════════════════════════════
const CELEBRATIONS = [
  { emojis: ['🌟', '✨', '⭐', '💫'], label: 'Stellar!' },
  { emojis: ['🔥', '💥', '⚡', '🌟'], label: 'On fire!' },
  { emojis: ['💜', '💖', '💗', '💝'], label: 'Lovely!' },
  { emojis: ['🚀', '⭐', '🌙', '☀️'], label: 'Liftoff!' },
  { emojis: ['🦋', '🌸', '🌺', '🌈'], label: 'Beautiful!' },
  { emojis: ['🎯', '🏆', '👑', '🥇'], label: 'Bullseye!' },
  { emojis: ['🐬', '🌊', '🐚', '🦈'], label: 'Splashy!' },
  { emojis: ['🎸', '🎵', '🎶', '🎤'], label: 'Rock on!' },
  { emojis: ['🍕', '🎂', '🍩', '🧁'], label: 'Sweet!' },
  { emojis: ['🦄', '🌈', '✨', '💫'], label: 'Magic!' },
]

function MiniCelebration({ triggerKey }) {
  const containerRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!triggerKey || !containerRef.current) return
    const container = containerRef.current
    container.innerHTML = ''
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const idx = triggerKey % CELEBRATIONS.length
    const { emojis } = CELEBRATIONS[idx]

    const count = 9 + Math.floor(Math.random() * 9)
    const power = 1.2 + Math.random() * 1.0
    const duration = 0.7 + Math.random() * 0.3
    const originX = 38 + Math.random() * 24
    const originY = 32 + Math.random() * 22
    const sizeBase = 20 + Math.random() * 8
    const sizeVar = 8 + Math.random() * 14

    // Pre-build all particle data
    const particles = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 360 + Math.random() * 25
      const rad = (angle * Math.PI) / 180
      const dist = (150 + Math.random() * 180) * power
      particles.push({
        emoji: emojis[i % emojis.length],
        dx: Math.cos(rad) * dist,
        dy: Math.sin(rad) * dist,
        rot: (Math.random() - 0.5) * 90,
        x: originX + (Math.random() - 0.5) * 4,
        y: originY + (Math.random() - 0.5) * 4,
        size: sizeBase + Math.random() * sizeVar,
        delay: Math.random() * 0.05,
      })
    }

    // Step 1: inject stylesheet with all keyframes
    const styleEl = document.createElement('style')
    let css = ''
    particles.forEach((p, i) => {
      const name = `mc${triggerKey}p${i}`
      css += `@keyframes ${name}{from{transform:translate(0,0) scale(1.15);opacity:1}` +
        `to{transform:translate(${p.dx}px,${p.dy}px) scale(0.3) rotate(${p.rot}deg);opacity:0}}\n`
    })
    styleEl.textContent = css
    container.appendChild(styleEl)

    // Step 2: wait one frame for styles to be parsed, THEN add animated elements
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment()
        particles.forEach((p, i) => {
          const el = document.createElement('div')
          el.textContent = p.emoji
          el.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;` +
            `font-size:${p.size}px;pointer-events:none;will-change:transform;` +
            `animation:mc${triggerKey}p${i} ${duration}s ease-out ${p.delay}s both;`
          fragment.appendChild(el)
        })
        container.appendChild(fragment)
      })
    })

    const timer = setTimeout(() => { container.innerHTML = '' }, Math.ceil(duration * 1000) + 500)
    return () => { clearTimeout(timer); if (rafRef.current) cancelAnimationFrame(rafRef.current); container.innerHTML = '' }
  }, [triggerKey])

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }} />
}

// ═══════════════════════════════════════════════════════════════
// QUIZ BUCKET ANIMATIONS
// ═══════════════════════════════════════════════════════════════
const BUCKET_CFG = {
  learning: { label: 'Learning', icon: '📚', color: C.blue, dot: '#9DD7FB', borderActive: 'rgba(28,176,246,0.5)' },
  review:   { label: 'Review',   icon: '🔁', color: C.purple, dot: '#E2BFFF', borderActive: 'rgba(168,85,247,0.5)' },
  mastered: { label: 'Mastered', icon: '⭐', color: C.gold, dot: '#FCCF7E', borderActive: 'rgba(245,166,35,0.5)' },
}

// ═══════════════════════════════════════════════════════════════
// VOCAB MESSAGES — Vocab words used as social messages
// ═══════════════════════════════════════════════════════════════
const CONGRATS_MESSAGES = [
  { word: 'Felicitations', body: 'Felicitations on your milestone!', def: 'Expressions of good wishes; congratulations' },
  { word: 'Commendations', body: 'Commendations on your achievement!', def: 'Praise; expressions of approval for merit' },
  { word: 'Laudable', body: 'What a laudable achievement!', def: 'Deserving praise and commendation' },
  { word: 'Monumental', body: 'A truly monumental milestone!', def: 'Great in importance, extent, or size' },
  { word: 'Prodigious', body: 'Prodigious progress — well done!', def: 'Remarkably great in extent, size, or degree' },
  { word: 'Exemplary', body: 'Truly exemplary effort!', def: 'Serving as a desirable model; outstanding' },
  { word: 'Superlative', body: 'Superlative work!', def: 'Of the highest quality or degree' },
  { word: 'Illustrious', body: 'An illustrious accomplishment!', def: 'Well known and esteemed; renowned' },
]
const GENERAL_MESSAGES = [
  { word: 'Salutations', body: 'Salutations, friend!', def: 'A greeting; an expression of goodwill' },
  { word: 'Persevere', body: 'Persevere — you\'ve got this!', def: 'To continue in a course of action despite difficulty' },
  { word: 'Indefatigable', body: 'You\'re absolutely indefatigable!', def: 'Persisting tirelessly; untiring' },
  { word: 'Tenacious', body: 'Keep being tenacious!', def: 'Persistent; holding firmly to something' },
  { word: 'Diligent', body: 'You\'re truly diligent!', def: 'Having or showing care and conscientiousness in work' },
  { word: 'Resolute', body: 'Stay resolute!', def: 'Admirably purposeful, determined, and unwavering' },
  { word: 'Formidable', body: 'You\'re formidable!', def: 'Inspiring respect or awe through being impressively powerful' },
  { word: 'Ebullient', body: 'Sending ebullient good vibes!', def: 'Cheerful and full of energy; enthusiastic' },
]
const ENCOURAGEMENT_WORDS = [
  { word: 'Perspicacious', def: 'Having keen mental perception and understanding' },
  { word: 'Indomitable', def: 'Impossible to defeat or discourage' },
  { word: 'Sagacious', def: 'Having or showing keen discernment and good judgment' },
  { word: 'Assiduous', def: 'Showing great care and perseverance' },
  { word: 'Intrepid', def: 'Fearless; adventurous' },
  { word: 'Astute', def: 'Having the ability to notice and understand things clearly' },
  { word: 'Stalwart', def: 'Loyal, reliable, and hardworking' },
  { word: 'Voracious', def: 'Wanting or devouring great quantities' },
  { word: 'Luminous', def: 'Shining; full of light and intelligence' },
  { word: 'Effulgent', def: 'Shining brightly; radiant' },
]



function FlyingPill({ word, from, to, sourceColor, targetColor, onDone }) {
  const outerRef = useRef(null)
  const pillRef = useRef(null)
  useEffect(() => {
    const outer = outerRef.current
    const pill = pillRef.current
    if (!outer || !pill) return

    // Phase 1: fly to bucket at readable size, in source color
    outer.style.left = from.x + 'px'
    outer.style.top = from.y + 'px'
    outer.style.opacity = '1'
    pill.style.background = sourceColor
    pill.style.boxShadow = `0 6px 24px ${sourceColor}60, 0 2px 8px rgba(0,0,0,0.12)`

    requestAnimationFrame(() => requestAnimationFrame(() => {
      outer.style.transition = 'left 0.55s cubic-bezier(0.22, 1.15, 0.36, 1), top 0.55s cubic-bezier(0.22, 1.15, 0.36, 1)'
      outer.style.left = to.x + 'px'
      outer.style.top = to.y + 'px'
    }))

    // Phase 2: after arriving, shift color and shrink to dot
    const shrinkTimer = setTimeout(() => {
      pill.style.transition = 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
      pill.style.background = targetColor
      pill.style.boxShadow = `0 2px 8px ${targetColor}60`
      pill.style.padding = '0'
      pill.style.fontSize = '0px'
      pill.style.width = '5px'
      pill.style.height = '5px'
      pill.style.minWidth = '5px'
      pill.style.borderRadius = '50%'
      pill.style.color = 'transparent'
    }, 580)

    const fadeTimer = setTimeout(() => {
      outer.style.transition = 'opacity 0.15s ease'
      outer.style.opacity = '0'
    }, 850)

    const doneTimer = setTimeout(onDone, 1000)
    return () => { clearTimeout(shrinkTimer); clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [])

  return (
    <div ref={outerRef} style={{ position: 'fixed', zIndex: 9999, pointerEvents: 'none', opacity: 0 }}>
      <div ref={pillRef} style={{
        background: sourceColor, color: '#fff', padding: '5px 14px', borderRadius: 50,
        fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden',
        boxShadow: `0 6px 24px ${sourceColor}60, 0 2px 8px rgba(0,0,0,0.12)`,
        display: 'inline-block',
      }}>{word}</div>
    </div>
  )
}

function QuizBucket({ cfg, count, totalWords, isTarget, innerRef }) {
  return (
    <div ref={innerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
        <span style={{ fontSize: 11 }}>{cfg.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, letterSpacing: 0.5, textTransform: 'uppercase' }}>{cfg.label}</span>
      </div>
      <div style={{
        width: '100%', height: 52, position: 'relative',
        borderRadius: 12,
        border: `2px solid ${isTarget ? cfg.borderActive : '#E8E8E8'}`,
        background: 'white', overflow: 'hidden',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        boxShadow: isTarget ? `0 0 16px ${cfg.color}25` : '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: count > 99 ? 18 : 22, fontWeight: 900,
          color: count > 0 ? cfg.color : '#E0E0E0',
          lineHeight: 1,
        }}>{count}</span>
      </div>
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
      
      <h1 style={{ fontSize: 28, fontWeight: 800, color: C.grayDark, margin: '0 0 4px' }}>Daily Vocab</h1>
      <p style={{ color: C.gray, margin: '0 0 32px', fontSize: 15 }}>5 words a day. That's it! 🎯</p>

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
        
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.grayDark, margin: '20px 0 8px' }}>
          {isFirstTime ? `Welcome, ${name}! 🎉` : 'How It Works'}
        </h1>
        <p style={{ color: C.gray, fontSize: 15, margin: '0 0 28px', lineHeight: 1.5 }}>
          It's super simple — just 3 steps each day:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28, textAlign: 'left' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📖</div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: C.grayDark, margin: '0 0 2px' }}>Flip through 5 new words</p>
              <p style={{ color: C.gray, fontSize: 14, margin: 0, lineHeight: 1.4 }}>See each word, its meaning, and a sentence.</p>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>✍️</div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: C.grayDark, margin: '0 0 2px' }}>Take a quick quiz</p>
              <p style={{ color: C.gray, fontSize: 14, margin: 0, lineHeight: 1.4 }}>Pick the right definition. No pressure!</p>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💜</div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: C.grayDark, margin: '0 0 2px' }}>Send a friend some love</p>
              <p style={{ color: C.gray, fontSize: 14, margin: 0, lineHeight: 1.4 }}>Build a fun vocab message to encourage a friend!</p>
            </div>
          </div>
        </div>

        <p style={{ color: C.gray, fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
          Do it every day and watch your streak grow! 🔥
        </p>

        <button onClick={onDismiss} style={{ width: '100%', padding: '18px 0', background: C.green, color: 'white', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}` }}>
          {isFirstTime ? "Let's Go! 🚀" : 'Got it! ✓'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════
function HomeScreen({ profile, srsCards, onStartSession, onLogout, onShowHowItWorks, onFriends, unreadCount, userId }) {
  const today = getToday()
  const dayDone = profile.today_complete && profile.last_session_date === today

  // Load encouragement: friend message or vocab word
  const [friendMsg, setFriendMsg] = useState(null)
  const [encourageReady, setEncourageReady] = useState(false)
  useEffect(() => {
    if (userId) {
      getMessages(userId).then(msgs => {
        const unread = msgs.filter(m => !m.read)
        if (unread.length > 0) {
          setFriendMsg(unread[0]) // show most recent
        }
        setEncourageReady(true)
      }).catch(() => setEncourageReady(true))
    } else {
      setEncourageReady(true)
    }
  }, [userId])

  // Pick encouragement word (deterministic per day)
  const dayHash = today.split('-').reduce((a, b) => a + parseInt(b), 0)
  const encourageWord = ENCOURAGEMENT_WORDS[dayHash % ENCOURAGEMENT_WORDS.length]

  const dismissFriendMsg = () => {
    if (friendMsg) markMessagesRead(userId).catch(() => {})
    setFriendMsg(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onShowHowItWorks} style={{ background: 'none', border: 'none', color: C.blue, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>How it works</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onFriends} style={{ background: 'none', border: 'none', color: C.purple, cursor: 'pointer', fontSize: 13, fontWeight: 600, position: 'relative' }}>
            Friends
            {unreadCount > 0 && <span style={{ position: 'absolute', top: -6, right: -10, background: C.red, color: 'white', fontSize: 9, fontWeight: 800, borderRadius: 10, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>{unreadCount}</span>}
          </button>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: C.gray, cursor: 'pointer', fontSize: 13 }}>Sign Out</button>
        </div>
      </div>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
        {/* Greeting */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.grayDark, margin: '0 0 4px' }}>
            {dayDone ? '🎉 You did it today!' : `Hey, ${profile.name}!`}
          </h2>
          <p style={{ color: C.gray, margin: 0, fontSize: 14 }}>
            {dayDone ? 'Come back tomorrow to keep your streak alive.' : 'Ready for your 5 words?'}
          </p>
        </div>

        {/* Streak — the ONE metric */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'white', padding: '20px 36px', borderRadius: 20, border: '2px solid #F0F0F0' }}>
            <FlameIcon size={42} active={profile.streak > 0} />
            <div>
              <div style={{ fontSize: 42, fontWeight: 900, color: profile.streak > 0 ? C.red : C.gray, lineHeight: 1 }}>{profile.streak}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: profile.streak > 0 ? C.red : C.gray, marginTop: 2 }}>Day Streak</div>
            </div>
          </div>
        </div>

        {/* Encouragement card: friend message OR vocab word */}
        {encourageReady && (
          <div style={{ background: 'white', borderRadius: 20, border: '2px solid #F0F0F0', padding: 20, marginBottom: 24, textAlign: 'center' }}>
            {friendMsg ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>💌</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.purple }}>{friendMsg.from_name} says:</span>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: C.purple, margin: '0 0 6px' }}>{friendMsg.message_body}</p>
                <p style={{ fontSize: 13, color: C.gray, margin: '0 0 12px', fontStyle: 'italic' }}>
                  {friendMsg.vocab_word} — {[...CONGRATS_MESSAGES, ...GENERAL_MESSAGES].find(v => v.word === friendMsg.vocab_word)?.def || ''}
                </p>
                <button onClick={dismissFriendMsg} style={{ background: 'none', border: 'none', color: C.gray, cursor: 'pointer', fontSize: 12 }}>Dismiss</button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 20, fontWeight: 900, color: C.purple, margin: '0 0 6px' }}>You are {encourageWord.word.toLowerCase()}!</p>
                <p style={{ fontSize: 14, color: C.gray, margin: 0, fontStyle: 'italic' }}>{encourageWord.word} — {encourageWord.def}</p>
              </>
            )}
          </div>
        )}

        {/* Start button */}
        {!dayDone ? (
          <button onClick={() => onStartSession(false)} style={{ width: '100%', padding: '18px 0', background: C.green, color: 'white', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}` }}>Start Today's Words 📖</button>
        ) : (
          <button onClick={() => onStartSession(true)} style={{ width: '100%', padding: '16px 0', background: C.purple, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: '0 4px 0 #A855F7' }}>Practice More 💪</button>
        )}
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
  const [milestoneMsg, setMilestoneMsg] = useState(null) // e.g. { count: 10, group: 1 }
  const [feedbackWillMaster, setFeedbackWillMaster] = useState(false) // captured at answer time
  const [miniCelebKey, setMiniCelebKey] = useState(0) // triggers varied celebrations

  // Bucket animation state (kept for potential future use)
  const wordCardRef = useRef(null)
  const pendingUpdate = useRef(null) // stores { word, card, wasCorrect } until animation ends

  // Local mutable copy of cards for this session
  const [localCards, setLocalCards] = useState({ ...srsCards })
  const [localIntroduced, setLocalIntroduced] = useState([...(profile.words_introduced || [])])
  // Ref-based mirror of localCards — always up to date even before React re-renders.
  // This is the authoritative source for handleQuitQuiz saves.
  const cardsRef = useRef({ ...srsCards })
  const introducedRef = useRef([...(profile.words_introduced || [])])

  // Compute live bucket counts from localCards
  const liveBuckets = useMemo(() => {
    let learning = 0, review = 0, mastered = 0
    localIntroduced.forEach(w => {
      const c = localCards[w]; if (!c) return
      const rep = parseInt(c.repetition, 10) || 0
      if (rep >= 2) mastered++
      else if (rep === 1) review++
      else learning++
    })
    return { learning, review, mastered }
  }, [localCards, localIntroduced])

  // Determine which bucket a word currently sits in
  const getBucket = (word) => {
    const c = localCards[word]; if (!c) return null
    const rep = parseInt(c.repetition, 10) || 0
    if (rep >= 2) return 'mastered'
    if (rep === 1) return 'review'
    return 'learning'
  }

  // Apply pending card update to localCards (called by onFlyDone or continueQuiz)
  // Does NOT clear pendingUpdate.current — that's done by continueQuiz/handleQuitQuiz
  // so quit-mid-quiz can always access the latest card state.
  const applyPendingUpdate = () => {
    const pending = pendingUpdate.current
    if (!pending) return
    // Update refs immediately (synchronous — always up to date)
    cardsRef.current = { ...cardsRef.current, [pending.word]: pending.card }
    if (!introducedRef.current.includes(pending.word)) introducedRef.current = [...introducedRef.current, pending.word]
    // Update React state (async — triggers re-render)
    setLocalCards(prev => ({ ...prev, [pending.word]: pending.card }))
    setLocalIntroduced(prev => prev.includes(pending.word) ? prev : [...prev, pending.word])
  }

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

  const submitAnswer = () => {
    if (showFeedback || !selected) return
    const ans = selected

    setSelected(ans)
    setShowFeedback(true)
    const q = quizWords[qIndex]
    const correctDef = getWordData(q.word).definition
    const isCorrect = ans === correctDef
    const existCard = localCards[q.word]
    const existRep = existCard ? (parseInt(existCard.repetition, 10) || 0) : 0

    // Confetti if mastering
    const willMaster = isCorrect && existRep >= 1 && initialMode !== 'masteredQuiz'
    setFeedbackWillMaster(willMaster)
    // Mini celebration on every correct answer
    if (isCorrect) {
      setMiniCelebKey(k => k + 1)
    }
    if (willMaster) {
      setConfettiKey(k => k + 1)
      // Check for milestone (every 10 mastered words)
      const currentMastered = liveBuckets.mastered
      const newMastered = currentMastered + 1
      if (newMastered % 10 === 0) {
        setMilestoneMsg({ count: newMastered, group: newMastered / 10 })
      } else {
        setMilestoneMsg(null)
      }
    } else {
      setMilestoneMsg(null)
    }

    // Pre-compute the card update (applied when animation ends)
    const existing = localCards[q.word] || createSRSCard(q.word)
    let updated = updateSRSCard(existing, isCorrect)
    if (initialMode === 'masteredQuiz' && !isCorrect) {
      updated = { ...updated, repetition: 1, status: 'review' }
    }
    pendingUpdate.current = { word: q.word, card: updated, wasCorrect: isCorrect }

    // Apply card update immediately (no bucket animation needed)
    applyPendingUpdate()
  }

  const continueQuiz = () => {
    const w = quizWords[qIndex]
    const correctDef = getWordData(w.word).definition
    const wasCorrect = selected === correctDef

    // Card was already applied in submitAnswer — grab it from refs or pending
    let updatedCard
    if (pendingUpdate.current && pendingUpdate.current.word === w.word) {
      updatedCard = pendingUpdate.current.card
    } else {
      updatedCard = localCards[w.word] || createSRSCard(w.word)
    }
    pendingUpdate.current = null

    const newResults = [...results, { word: w.word, wasCorrect, newCard: updatedCard }]
    if (qIndex < quizWords.length - 1) {
      setResults(newResults); setQIndex(qIndex + 1); setSelected(null); setShowFeedback(false)
    } else {
      finishQuiz(newResults)
    }
  }

  // Save progress and exit when user quits mid-quiz
  const handleQuitQuiz = async () => {
    let allResults = [...results]
    // Use refs (not state) as base — refs are always up to date synchronously
    let cardsToSave = { ...cardsRef.current }
    let introducedToSave = [...introducedRef.current]

    // Apply any pending card update (unapplied answer or animation in progress)
    if (pendingUpdate.current) {
      const p = pendingUpdate.current
      cardsToSave[p.word] = p.card
      if (!introducedToSave.includes(p.word)) introducedToSave.push(p.word)
      if (!allResults.some(r => r.word === p.word)) {
        allResults.push({ word: p.word, wasCorrect: p.wasCorrect, newCard: p.card })
      }
      pendingUpdate.current = null
    }

    // Always save current card state
    allResults.forEach(r => { if (!introducedToSave.includes(r.word)) introducedToSave.push(r.word) })
    console.log(`[handleQuitQuiz] Saving ${Object.keys(cardsToSave).length} cards, ${allResults.length} new results`)
    await saveToDB(cardsToSave, introducedToSave, false, allResults)
    onComplete()
  }

  const finishQuiz = async (quizResults) => {
    const newCards = { ...cardsRef.current }
    const newIntroduced = [...introducedRef.current]
    quizResults.forEach(r => { newCards[r.word] = r.newCard; if (!newIntroduced.includes(r.word)) newIntroduced.push(r.word) })
    sessionNewWords.forEach(w => { if (!newIntroduced.includes(w)) newIntroduced.push(w); if (!newCards[w]) newCards[w] = createSRSCard(w) })

    console.log('[finishQuiz] Card states being saved:')
    quizResults.forEach(r => console.log(`  ${r.word}: rep=${r.newCard.repetition} status=${r.newCard.status} correct=${r.wasCorrect}`))

    setLocalCards(newCards)
    setLocalIntroduced(newIntroduced)
    cardsRef.current = newCards
    introducedRef.current = newIntroduced
    setResults(quizResults)

    // Switch to celebration IMMEDIATELY — save in background to avoid flash
    setPhase('celebration')
    completeDayAndSave(newCards, newIntroduced, quizResults).catch(e => console.error('Background save error:', e))
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
      <Spinner text="Preparing your words..." />
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
            <span style={{ fontSize: 12, fontWeight: 700, color: C.gray }}>New word {cardIndex + 1} of {sessionNewWords.length}</span>
          </div>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {profile.sessions_completed === 0 && (
            <p style={{ color: C.blue, fontSize: 16, fontWeight: 600, margin: '0 0 16px', letterSpacing: 0.3 }}>Tap to flip for definition</p>
          )}
          <div onClick={() => setFlipped(!flipped)} style={{ width: '100%', maxWidth: 340, height: 280, cursor: 'pointer', perspective: 1000 }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', transition: 'transform 0.5s', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', background: 'white', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '2px solid #F0F0F0' }}>
                <h2 style={{ fontSize: 30, fontWeight: 800, color: C.grayDark, margin: '0 0 16px' }}>{word}</h2>
                <p style={{ color: C.gray, textAlign: 'center', fontStyle: 'italic', fontSize: 15, lineHeight: 1.6 }}>"{data.sentence}"</p>
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
    const curBucket = getBucket(q.word)
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <ConfettiBurst active={confettiKey} />
        <MiniCelebration triggerKey={miniCelebKey} />
        <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0' }}>
          <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleQuitQuiz} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20 }}>✕</button>
            <div style={{ flex: 1, height: 12, background: '#E5E5E5', borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${((qIndex + 1) / quizWords.length) * 100}%`, background: C.green, borderRadius: 6, transition: 'width 0.3s' }} /></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.gray }}>Quiz {qIndex + 1} of {quizWords.length}</span>
          </div>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: '16px 16px 24px', width: '100%', boxSizing: 'border-box' }}>

          {/* ── Word card ── */}
          <div ref={wordCardRef}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>✍️</span><p style={{ color: C.grayDark, fontWeight: 700, fontSize: 16, margin: 0 }}>What does this word mean?</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: C.grayDark, margin: 0 }}>{q.word}</h2>
              {!curBucket && (
                <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#D7FFB8', color: C.green }}>
                  NEW
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.options.map((opt, i) => {
              let bg = 'white', border = '2px solid #E5E5E5', color = C.grayDark
              if (showFeedback) {
                if (opt === data.definition) { bg = C.greenLight; border = `2px solid ${C.green}`; color = C.greenDark }
                else if (opt === selected && !isCorrect) { bg = C.redLight; border = `2px solid ${C.red}`; color = C.red }
              } else if (opt === selected) { border = `2px solid ${C.blue}`; bg = '#E8F5FE' }
              return <button key={i} onClick={() => !showFeedback && setSelected(opt)} style={{ width: '100%', padding: '14px 16px', textAlign: 'left', background: bg, border, borderRadius: 14, color, fontWeight: 600, fontSize: 14, cursor: showFeedback ? 'default' : 'pointer', lineHeight: 1.4 }}>{opt}</button>
            })}
          </div>
          {selected && !showFeedback && (
            <button onClick={submitAnswer} style={{ width: '100%', padding: '14px 0', marginTop: 12, background: C.green, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}` }}>Submit Answer</button>
          )}
          {showFeedback && (() => {
            const willMaster = feedbackWillMaster
            const celebLabel = CELEBRATIONS[(miniCelebKey) % CELEBRATIONS.length]?.label || 'Nice!'
            return (
            <div style={{ background: isCorrect ? C.greenLight : C.redLight, padding: 16, borderRadius: 16, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>{isCorrect ? (willMaster ? '🌟' : '✅') : '💪'}</span>
                <span style={{ fontWeight: 800, color: isCorrect ? C.greenDark : C.red, fontSize: 16 }}>{isCorrect ? (willMaster ? 'Amazing!' : celebLabel) : 'Almost!'}</span>
              </div>
              {isCorrect ? (
                <p style={{ margin: '0 0 12px', fontSize: 14, color: C.greenDark }}>
                  {willMaster ? "You really know this one! 🎉" : 'You got it! Keep it up.'}
                </p>
              ) : (
                <div>
                  <p style={{ margin: '0 0 4px', color: C.red, fontSize: 14 }}><strong>{q.word}</strong> means: {data.definition}</p>
                  <p style={{ margin: '0 0 12px', fontSize: 14, color: C.red }}>No worries — you'll see it again soon!</p>
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

  // ── CELEBRATION + MESSAGE BUILDER ──
  if (phase === 'celebration') {
    return <CelebrationWithMessageBuilder
      profile={profile}
      userId={userId}
      isSprint={isSprint}
      onComplete={onComplete}
    />
  }

  return null
}

// ═══════════════════════════════════════════════════════════════
// MAD LIBS MESSAGE BUILDER — Fill-in-the-blanks vocab fun
// ═══════════════════════════════════════════════════════════════
const MADLIB_TEMPLATES = [
  {
    text: 'Your {adj1} brain is more {adj2} than a {noun}!',
    slots: [
      { id: 'adj1', type: 'adj', label: 'adjective' },
      { id: 'adj2', type: 'adj', label: 'adjective' },
      { id: 'noun', type: 'noun', label: 'noun' },
    ],
  },
  {
    text: 'I hereby declare you the most {adj1} {noun} in the {adj2} universe!',
    slots: [
      { id: 'adj1', type: 'adj', label: 'adjective' },
      { id: 'noun', type: 'noun', label: 'noun' },
      { id: 'adj2', type: 'adj', label: 'adjective' },
    ],
  },
  {
    text: 'May your {noun1} always be {adj} and your {noun2} forever {adv}!',
    slots: [
      { id: 'noun1', type: 'noun', label: 'noun' },
      { id: 'adj', type: 'adj', label: 'adjective' },
      { id: 'noun2', type: 'noun', label: 'noun' },
      { id: 'adv', type: 'adv', label: 'adverb' },
    ],
  },
  {
    text: "You're so {adj1} that even a {noun} would be {adj2}!",
    slots: [
      { id: 'adj1', type: 'adj', label: 'adjective' },
      { id: 'noun', type: 'noun', label: 'noun' },
      { id: 'adj2', type: 'adj', label: 'adjective' },
    ],
  },
  {
    text: 'A {adj1} {noun1} once said: always be {adj2} like a {noun2}!',
    slots: [
      { id: 'adj1', type: 'adj', label: 'adjective' },
      { id: 'noun1', type: 'noun', label: 'noun' },
      { id: 'adj2', type: 'adj', label: 'adjective' },
      { id: 'noun2', type: 'noun', label: 'noun' },
    ],
  },
  {
    text: 'Breaking news: {adj1} person spotted being {adv} {adj2}!',
    slots: [
      { id: 'adj1', type: 'adj', label: 'adjective' },
      { id: 'adv', type: 'adv', label: 'adverb' },
      { id: 'adj2', type: 'adj', label: 'adjective' },
    ],
  },
]

const MADLIB_WORDS = {
  adj: [
    { word: 'Indomitable', def: 'Impossible to defeat or discourage' },
    { word: 'Tenacious', def: 'Persistent; holding firmly' },
    { word: 'Formidable', def: 'Impressively powerful' },
    { word: 'Exemplary', def: 'Serving as an outstanding model' },
    { word: 'Prodigious', def: 'Remarkably great' },
    { word: 'Ebullient', def: 'Cheerful and full of energy' },
    { word: 'Resplendent', def: 'Dazzling; gorgeous' },
    { word: 'Luminous', def: 'Shining brightly; radiant' },
    { word: 'Intrepid', def: 'Fearless; adventurous' },
    { word: 'Sagacious', def: 'Having keen judgment' },
    { word: 'Magnanimous', def: 'Very generous or forgiving' },
    { word: 'Ineffable', def: 'Too great to express in words' },
    { word: 'Scintillating', def: 'Brilliantly clever or skillful' },
    { word: 'Gargantuan', def: 'Enormously large' },
    { word: 'Capricious', def: 'Given to sudden change; unpredictable' },
  ],
  noun: [
    { word: 'Paragon', def: 'A model of excellence' },
    { word: 'Juggernaut', def: 'A huge, unstoppable force' },
    { word: 'Phenomenon', def: 'A remarkable occurrence' },
    { word: 'Enigma', def: 'A mystery; a puzzle' },
    { word: 'Prodigy', def: 'A young person with exceptional talent' },
    { word: 'Labyrinth', def: 'A complicated maze' },
    { word: 'Epiphany', def: 'A sudden brilliant realization' },
    { word: 'Conundrum', def: 'A confusing problem' },
    { word: 'Pandemonium', def: 'Wild uproar and chaos' },
    { word: 'Catalyst', def: 'Something that causes change' },
    { word: 'Hippopotamus', def: 'A large African mammal' },
    { word: 'Platypus', def: 'An egg-laying Australian mammal' },
  ],
  adv: [
    { word: 'Voraciously', def: 'In an eager, enthusiastic way' },
    { word: 'Resolutely', def: 'In a determined manner' },
    { word: 'Effervescently', def: 'In a bubbly, enthusiastic way' },
    { word: 'Magnificently', def: 'In an impressively beautiful way' },
    { word: 'Audaciously', def: 'In a bold, daring manner' },
    { word: 'Flamboyantly', def: 'In a showy, confident way' },
    { word: 'Serendipitously', def: 'By happy chance' },
    { word: 'Spontaneously', def: 'Without planning; impulsively' },
  ],
}

function CelebrationWithMessageBuilder({ profile, userId, isSprint, onComplete }) {
  const [step, setStep] = useState('celebrate') // celebrate | pickFriend | buildMsg | sent
  const [friends, setFriends] = useState([])
  const [friendsLoaded, setFriendsLoaded] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [sending, setSending] = useState(false)

  // Mad Libs state
  const [filledSlots, setFilledSlots] = useState({}) // { slotId: { word, def } }
  const [activeSlot, setActiveSlot] = useState(null) // which slot is being filled

  const today = getToday()
  const alreadyDoneToday = profile.today_complete && profile.last_session_date === today
  const displayStreak = alreadyDoneToday ? profile.streak : (profile.last_session_date !== today ? profile.streak + 1 : profile.streak)

  // Pick a random template
  const [templateIdx] = useState(() => Math.floor(Math.random() * MADLIB_TEMPLATES.length))
  const tmpl = MADLIB_TEMPLATES[templateIdx]

  // Shuffle word banks once
  const [shuffledWords] = useState(() => {
    const result = {}
    Object.keys(MADLIB_WORDS).forEach(type => {
      result[type] = [...MADLIB_WORDS[type]].sort(() => Math.random() - 0.5).slice(0, 6)
    })
    return result
  })

  useEffect(() => {
    if (userId) {
      getFollowing(userId).then(f => { setFriends(f); setFriendsLoaded(true) }).catch(() => setFriendsLoaded(true))
    } else {
      setFriendsLoaded(true)
    }
  }, [userId])

  // Auto-select first unfilled slot
  useEffect(() => {
    if (step === 'buildMsg' && !activeSlot) {
      const first = tmpl.slots.find(s => !filledSlots[s.id])
      if (first) setActiveSlot(first.id)
    }
  }, [step])

  // Build the message from template + filled slots
  const buildMessage = () => {
    let msg = tmpl.text
    tmpl.slots.forEach(slot => {
      const filled = filledSlots[slot.id]
      msg = msg.replace(`{${slot.id}}`, filled ? filled.word.toLowerCase() : `[${slot.label}]`)
    })
    return msg
  }

  const builtMessage = buildMessage()
  const allSlotsFilled = tmpl.slots.every(s => filledSlots[s.id])
  const filledCount = tmpl.slots.filter(s => filledSlots[s.id]).length

  const handleWordTap = (word) => {
    if (!activeSlot) return
    const newFilled = { ...filledSlots, [activeSlot]: word }
    setFilledSlots(newFilled)
    // Auto-advance to next empty slot
    const nextEmpty = tmpl.slots.find(s => s.id !== activeSlot && !newFilled[s.id])
    setActiveSlot(nextEmpty ? nextEmpty.id : null)
    
  }

  const handleSend = async () => {
    if (!selectedFriend || !allSlotsFilled) return
    setSending(true)
    try {
      // Pick the first filled word as the vocab_word for the DB
      const firstWord = filledSlots[tmpl.slots[0].id]
      await sendMessage(userId, selectedFriend.id, firstWord.word, builtMessage, 'general')
      setStep('sent')
    } catch (e) { console.error('Send error:', e) }
    setSending(false)
  }

  if (step === 'celebrate') {
    return (
      <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${C.greenLight} 0%, ${C.bg} 40%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24 }}>
        <ConfettiBurst active={1} />
        <div style={{ marginTop: 40 }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'white', padding: '20px 36px', borderRadius: 20, border: '2px solid #F0F0F0', marginBottom: 12 }}>
          <FlameIcon size={42} active />
          <div>
            <div style={{ fontSize: 42, fontWeight: 900, color: C.red, lineHeight: 1 }}>{displayStreak}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.red, marginTop: 2 }}>Day Streak</div>
          </div>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.grayDark, margin: '8px 0 4px', textAlign: 'center' }}>
          {isSprint ? 'Extra practice done! 💪' : displayStreak === 1 ? 'Day 1 — great start!' : displayStreak < 7 ? `${displayStreak}-day streak!` : `${displayStreak}-day streak! 🔥`}
        </h2>
        <p style={{ color: C.gray, margin: '0 0 28px', fontSize: 14, textAlign: 'center' }}>
          {isSprint ? 'Nice extra effort!' : 'Come back tomorrow to keep it going!'}
        </p>

        {/* Prompt to send a friend encouragement — wait for load to avoid flash */}
        {!friendsLoaded ? (
          <div style={{ width: '100%', maxWidth: 340, textAlign: 'center', padding: 20 }}>
            <Spinner text="" />
          </div>
        ) : friends.length > 0 ? (
          <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'white', borderRadius: 20, border: '2px solid #F0F0F0', padding: 20, textAlign: 'center' }}>
              <span style={{ fontSize: 32 }}>💜</span>
              <p style={{ fontWeight: 800, fontSize: 16, color: C.purple, margin: '8px 0 4px' }}>Spread the love!</p>
              <p style={{ fontSize: 14, color: C.gray, margin: '0 0 14px' }}>Build a vocab message and send it to a friend.</p>
              <button onClick={() => setStep('pickFriend')} style={{ width: '100%', padding: '14px 0', background: C.purple, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, cursor: 'pointer', boxShadow: '0 4px 0 #A855F7' }}>Send a Friend Some Love 💬</button>
            </div>
            <button onClick={() => onComplete('done')} style={{ padding: '12px 0', background: 'transparent', color: C.gray, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' }}>Maybe later</button>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: `linear-gradient(135deg, ${C.green}15, ${C.green}05)`, border: `2px solid ${C.green}30`, borderRadius: 16, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>🎉</div>
              <p style={{ fontWeight: 800, fontSize: 16, color: C.greenDark, margin: '0 0 4px' }}>Session complete!</p>
              <p style={{ fontSize: 14, color: C.gray, margin: 0 }}>Add friends to send them encouragement!</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onComplete('friends')} style={{ flex: 1, padding: '14px 0', background: C.purple, color: 'white', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 14, cursor: 'pointer' }}>Find Friends</button>
              <button onClick={() => onComplete('done')} style={{ flex: 1, padding: '14px 0', background: '#F0F0F0', color: C.gray, fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 14, cursor: 'pointer' }}>Done</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (step === 'pickFriend') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setStep('celebrate')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20 }}>←</button>
          <span style={{ fontWeight: 700, color: C.grayDark, fontSize: 17 }}>Who's getting the love?</span>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {friends.map(f => (
              <button key={f.id} onClick={() => { setSelectedFriend(f); setStep('buildMsg') }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'white', border: '2px solid #F0F0F0', borderRadius: 16, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.purple + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: C.purple }}>{f.name?.[0]?.toUpperCase()}</div>
                <span style={{ fontWeight: 700, fontSize: 16, color: C.grayDark }}>{f.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 20 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'buildMsg') {
    const currentSlot = tmpl.slots.find(s => s.id === activeSlot)
    const currentType = currentSlot?.type
    const wordsForSlot = currentType ? (shuffledWords[currentType] || []) : []

    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setStep('pickFriend'); setFilledSlots({}); setActiveSlot(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20 }}>←</button>
          <span style={{ fontWeight: 700, color: C.grayDark, fontSize: 17 }}>Mad Libs Message!</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: C.purple }}>{filledCount}/{tmpl.slots.length} words</span>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, width: '100%', boxSizing: 'border-box' }}>
          {/* Message preview with clickable blanks */}
          <div style={{ background: 'white', borderRadius: 20, border: `2px solid ${allSlotsFilled ? C.purple : '#E5E5E5'}`, padding: 20, marginBottom: 20, textAlign: 'center', transition: 'border-color 0.3s' }}>
            <p style={{ fontSize: 13, color: C.gray, margin: '0 0 8px' }}>To: {selectedFriend?.name}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.grayDark, margin: 0, lineHeight: 1.6 }}>
              {(() => {
                // Render template with inline slot buttons
                const parts = tmpl.text.split(/\{(\w+)\}/)
                return parts.map((part, i) => {
                  const slot = tmpl.slots.find(s => s.id === part)
                  if (!slot) return <span key={i}>{part}</span>
                  const filled = filledSlots[slot.id]
                  const isActive = activeSlot === slot.id
                  return (
                    <button key={i}
                      onClick={() => { setActiveSlot(slot.id) }}
                      style={{
                        display: 'inline', padding: '2px 8px', margin: '0 2px',
                        borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontWeight: 800, fontSize: 18, lineHeight: 1.6,
                        background: filled ? C.purple + '18' : isActive ? C.purple + '25' : '#F0F0F0',
                        color: filled ? C.purple : isActive ? C.purple : C.gray,
                        textDecoration: isActive && !filled ? 'none' : 'none',
                        outline: isActive ? `2px solid ${C.purple}` : 'none',
                        outlineOffset: 1,
                        transition: 'all 0.2s',
                      }}>
                      {filled ? filled.word.toLowerCase() : `[${slot.label}]`}
                    </button>
                  )
                })
              })()}
            </p>
          </div>

          {/* Word bank for current slot */}
          {activeSlot && currentSlot && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.purple }}>Pick {currentSlot.label === 'adjective' ? 'an' : 'a'} {currentSlot.label}:</span>
                {filledSlots[activeSlot] && (
                  <button onClick={() => { setFilledSlots(prev => { const n = {...prev}; delete n[activeSlot]; return n }) }}
                    style={{ background: 'none', border: 'none', color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕ Clear</button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {wordsForSlot.map(w => {
                  const isSelected = filledSlots[activeSlot]?.word === w.word
                  const usedElsewhere = Object.entries(filledSlots).some(([sid, f]) => sid !== activeSlot && f.word === w.word)
                  return (
                    <button key={w.word}
                      onClick={() => !usedElsewhere && handleWordTap(w)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 14, width: '100%', textAlign: 'left',
                        background: isSelected ? C.purple : usedElsewhere ? '#F8F8F8' : 'white',
                        border: `2px solid ${isSelected ? C.purple : usedElsewhere ? '#E8E8E8' : C.purple + '30'}`,
                        cursor: usedElsewhere ? 'default' : 'pointer',
                        boxShadow: isSelected ? '0 3px 0 #A855F7' : usedElsewhere ? 'none' : '0 2px 0 #E5E5E5',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: isSelected ? 'white' : usedElsewhere ? '#D0D0D0' : C.purple }}>
                          {w.word}
                        </div>
                        <div style={{ fontSize: 12, color: isSelected ? 'rgba(255,255,255,0.8)' : usedElsewhere ? '#D0D0D0' : C.gray, marginTop: 2, lineHeight: 1.3 }}>
                          {w.def}
                        </div>
                      </div>
                      {isSelected && <span style={{ marginLeft: 'auto', fontSize: 16, color: 'white', flexShrink: 0 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* All filled — show shuffle & send */}
          {allSlotsFilled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { setFilledSlots({}); setActiveSlot(tmpl.slots[0].id) }}
                style={{ width: '100%', padding: '12px 0', background: 'white', color: C.purple, fontWeight: 700, fontSize: 14, border: `2px solid ${C.purple}40`, borderRadius: 14, cursor: 'pointer' }}>
                🔀 Remix it!
              </button>
              <button onClick={handleSend} disabled={sending}
                style={{ width: '100%', padding: '16px 0', background: C.purple, color: 'white', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: '0 4px 0 #A855F7', transition: 'all 0.2s' }}>
                {sending ? 'Sending...' : `Send to ${selectedFriend?.name} 💜`}
              </button>
            </div>
          )}

          {/* No active slot and not all filled — prompt */}
          {!activeSlot && !allSlotsFilled && (
            <p style={{ textAlign: 'center', color: C.gray, fontSize: 14 }}>Tap a blank above to fill it in!</p>
          )}
        </div>
      </div>
    )
  }

  if (step === 'sent') {
    return (
      <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${C.purpleLight} 0%, ${C.bg} 40%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ConfettiBurst active={1} />
        <span style={{ fontSize: 48 }}>💜</span>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.purple, margin: '12px 0 4px' }}>Sent!</h2>
        <p style={{ fontSize: 16, fontWeight: 700, color: C.grayDark, margin: '0 0 4px', textAlign: 'center' }}>"{builtMessage}"</p>
        <p style={{ fontSize: 14, color: C.gray, margin: '0 0 28px' }}>→ {selectedFriend?.name}</p>
        <button onClick={() => onComplete('done')} style={{ padding: '14px 36px', background: C.green, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, cursor: 'pointer', boxShadow: `0 4px 0 ${C.greenDark}` }}>Done for Today! 🎉</button>
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
    { id: 'all', label: 'All', count: allWords.length, color: C.grayDark },
    { id: 'learning', label: 'Learning', count: learning.length, color: C.blue },
    { id: 'review', label: 'Reviewing', count: reviewing.length, color: C.purple },
    { id: 'mastered', label: 'Mastered', count: mastered.length, color: C.gold },
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
          <div style={{ textAlign: 'center', padding: '40px 0' }}><p style={{ fontSize: 32, marginBottom: 8 }}>📚</p><p style={{ color: C.gray, marginTop: 12 }}>No words here yet!</p></div>
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
                  <p style={{ color: C.gray, fontSize: 14, margin: '4px 0 0', lineHeight: 1.4 }}>{data.definition}</p>
                  {c && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}><StrengthBars repetition={c.repetition} size={16} /><span style={{ fontSize: 12, color: C.gray }}>{c.repetition} correct in a row</span></div>}
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
          <span style={{ fontSize: 12, fontWeight: 700, color: C.gray }}>{index + 1} / {words.length}</span>
        </div>
      </div>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ color, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          {card && <SRSBadge interval={card.interval} status={card.status} />}
        </div>
        <div onClick={() => setFlipped(!flipped)} style={{ width: '100%', maxWidth: 340, height: 280, cursor: 'pointer', perspective: 1000 }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', transition: 'transform 0.5s', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', background: 'white', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: `2px solid ${color}30` }}>
              <h2 style={{ fontSize: 30, fontWeight: 800, color: C.grayDark, margin: '0 0 16px' }}>{word}</h2>
              <p style={{ color: C.gray, textAlign: 'center', fontStyle: 'italic', fontSize: 15, lineHeight: 1.6 }}>"{data.sentence}"</p>
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
// FRIENDS SCREEN
// ═══════════════════════════════════════════════════════════════
function MessageComposer({ toUser, messageType, onSend, onClose }) {
  const messages = messageType === 'congrats' ? CONGRATS_MESSAGES : GENERAL_MESSAGES
  const [selectedIdx, setSelectedIdx] = useState(0)
  const selected = messages[selectedIdx]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: C.grayDark }}>
          {messageType === 'congrats' ? `Congratulate ${toUser.name}!` : `Send ${toUser.name} a message`}
        </h3>
        <p style={{ color: C.gray, fontSize: 12, margin: '0 0 16px' }}>Pick a vocab word to send:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', marginBottom: 16 }}>
          {messages.map((m, i) => (
            <button key={m.word} onClick={() => setSelectedIdx(i)} style={{
              padding: '10px 12px', borderRadius: 12, border: i === selectedIdx ? `2px solid ${C.purple}` : '2px solid #E5E5E5',
              background: i === selectedIdx ? C.purple + '08' : 'white', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: i === selectedIdx ? C.purple : C.grayDark }}>{m.body}</div>
              <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}><em>{m.word}</em> — {m.def}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', background: '#F0F0F0', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: C.gray }}>Cancel</button>
          <button onClick={() => onSend(selected)} style={{ flex: 1, padding: '12px 0', background: C.purple, border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: 'white' }}>Send</button>
        </div>
      </div>
    </div>
  )
}

function FriendsScreen({ userId, onBack }) {
  const [tab, setTab] = useState('friends') // friends | find | inbox
  const [following, setFollowing] = useState([])
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [composeTo, setComposeTo] = useState(null) // { user, type }
  const [sendingStatus, setSendingStatus] = useState(null) // 'sent' message
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [f, m, u] = await Promise.all([getFollowing(userId), getMessages(userId), getUnreadCount(userId)])
      setFollowing(f)
      setMessages(m)
      setUnreadCount(u)
    } catch (e) { console.error('Friends load error:', e) }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await searchUsers(searchQuery.trim())
      setSearchResults(results.filter(r => r.id !== userId))
    } catch (e) { console.error('Search error:', e) }
    setSearching(false)
  }

  const handleFollow = async (targetId) => {
    try {
      await followUser(userId, targetId)
      await loadData()
      // Update search results to reflect follow
      const f = await getFollowing(userId)
      setFollowing(f)
    } catch (e) { console.error('Follow error:', e) }
  }

  const handleUnfollow = async (targetId) => {
    try {
      await unfollowUser(userId, targetId)
      const f = await getFollowing(userId)
      setFollowing(f)
    } catch (e) { console.error('Unfollow error:', e) }
  }

  const handleSendMessage = async (msg) => {
    if (!composeTo) return
    try {
      await sendMessage(userId, composeTo.user.id, msg.word, msg.body, composeTo.type)
      setComposeTo(null)
      setSendingStatus(`Sent "${msg.body}" to ${composeTo.user.name}!`)
      setTimeout(() => setSendingStatus(null), 3000)
    } catch (e) { console.error('Send error:', e) }
  }

  const handleOpenInbox = async () => {
    setTab('inbox')
    if (unreadCount > 0) {
      try {
        await markMessagesRead(userId)
        setUnreadCount(0)
        const m = await getMessages(userId)
        setMessages(m)
      } catch (e) { console.error('Mark read error:', e) }
    }
  }

  const followingIds = new Set(following.map(f => f.id))

  const tabStyle = (t) => ({
    flex: 1, padding: '10px 0', border: 'none', borderBottom: tab === t ? `3px solid ${C.purple}` : '3px solid transparent',
    background: 'none', fontWeight: 700, fontSize: 13, color: tab === t ? C.purple : C.gray, cursor: 'pointer', position: 'relative',
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {composeTo && <MessageComposer toUser={composeTo.user} messageType={composeTo.type} onSend={handleSendMessage} onClose={() => setComposeTo(null)} />}
      <div style={{ background: 'white', padding: '12px 20px', borderBottom: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 20 }}>←</button>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.grayDark, margin: 0 }}>Friends</h2>
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #F0F0F0' }}>
        <button onClick={() => setTab('friends')} style={tabStyle('friends')}>Friends ({following.length})</button>
        <button onClick={() => setTab('find')} style={tabStyle('find')}>Find</button>
        <button onClick={handleOpenInbox} style={tabStyle('inbox')}>
          Inbox
          {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: '25%', background: C.red, color: 'white', fontSize: 9, fontWeight: 800, borderRadius: 10, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>{unreadCount}</span>}
        </button>
      </div>
      {/* Explanation banner */}
      <div style={{ background: `linear-gradient(135deg, ${C.purple}08, ${C.blue}08)`, padding: '12px 20px', borderBottom: '1px solid #F0F0F0' }}>
        <p style={{ fontSize: 14, color: C.grayDark, margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
          📚 Learn together! Follow friends to send vocab-powered encouragement and celebrate each other's milestones.
        </p>
      </div>

      <div style={{ maxWidth: 400, margin: '0 auto', padding: 16 }}>
        {/* Sent confirmation toast */}
        {sendingStatus && (
          <div style={{ background: C.greenLight, border: `2px solid ${C.green}`, borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 600, color: C.greenDark, textAlign: 'center' }}>
            ✅ {sendingStatus}
          </div>
        )}

        {loading ? <Spinner text="Loading..." /> : (
          <>
            {/* ── FRIENDS TAB ── */}
            {tab === 'friends' && (
              <div>
                {following.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ fontSize: 32, marginBottom: 8 }}>👋</p>
                    <p style={{ color: C.gray, fontSize: 14 }}>No friends yet! Use the Find tab to search for friends.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {following.map(f => (
                      <div key={f.id} style={{ background: 'white', borderRadius: 14, padding: '12px 14px', border: '2px solid #F0F0F0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.purple + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: C.purple }}>
                              {f.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 14, color: C.grayDark }}>{f.name}</span>
                          </div>
                          <button onClick={() => handleUnfollow(f.id)} style={{ background: 'none', border: `1px solid ${C.red}30`, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: C.red, cursor: 'pointer' }}>Unfollow</button>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setComposeTo({ user: f, type: 'congrats' })} style={{ flex: 1, padding: '8px 0', background: C.gold + '15', border: `1px solid ${C.gold}40`, borderRadius: 10, fontSize: 12, fontWeight: 700, color: C.gold, cursor: 'pointer' }}>🏆 Congratulate</button>
                          <button onClick={() => setComposeTo({ user: f, type: 'general' })} style={{ flex: 1, padding: '8px 0', background: C.purple + '10', border: `1px solid ${C.purple}30`, borderRadius: 10, fontSize: 12, fontWeight: 700, color: C.purple, cursor: 'pointer' }}>💬 Message</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── FIND TAB ── */}
            {tab === 'find' && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by name..."
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: '2px solid #E5E5E5', fontSize: 14, outline: 'none' }}
                  />
                  <button onClick={handleSearch} disabled={searching} style={{ padding: '10px 18px', background: C.purple, color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {searching ? '...' : 'Search'}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {searchResults.map(r => {
                      const isFollowing = followingIds.has(r.id)
                      return (
                        <div key={r.id} style={{ background: 'white', borderRadius: 14, padding: '12px 14px', border: '2px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.blue + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: C.blue }}>
                              {r.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 14, color: C.grayDark }}>{r.name}</span>
                          </div>
                          {isFollowing ? (
                            <button onClick={() => handleUnfollow(r.id)} style={{ padding: '6px 14px', background: 'white', border: `2px solid ${C.gray}30`, borderRadius: 10, fontSize: 12, fontWeight: 700, color: C.gray, cursor: 'pointer' }}>Following ✓</button>
                          ) : (
                            <button onClick={() => handleFollow(r.id)} style={{ padding: '6px 14px', background: C.purple, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer' }}>Follow</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {searchResults.length === 0 && searchQuery && !searching && (
                  <p style={{ color: C.gray, textAlign: 'center', fontSize: 13, marginTop: 20 }}>No users found. Try a different name.</p>
                )}
              </div>
            )}

            {/* ── INBOX TAB ── */}
            {tab === 'inbox' && (
              <div>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ fontSize: 32, marginBottom: 8 }}>📬</p>
                    <p style={{ color: C.gray, fontSize: 14 }}>No messages yet!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {messages.map(m => (
                      <div key={m.id} style={{ background: m.read ? 'white' : C.purple + '06', borderRadius: 14, padding: '12px 14px', border: m.read ? '2px solid #F0F0F0' : `2px solid ${C.purple}20` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 14 }}>{m.message_type === 'congrats' ? '🏆' : '💬'}</span>
                          <span style={{ fontWeight: 700, fontSize: 13, color: C.grayDark }}>{m.from_name}</span>
                          {!m.read && <span style={{ fontSize: 8, color: C.purple }}>●</span>}
                        </div>
                        <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: C.purple }}>{m.message_body}</p>
                        <p style={{ margin: 0, fontSize: 12, color: C.gray }}><em>{m.vocab_word}</em> — {
                          [...CONGRATS_MESSAGES, ...GENERAL_MESSAGES].find(v => v.word === m.vocab_word)?.def || ''
                        }</p>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#C0C0C0' }}>{new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
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
  const [screen, setScreen] = useState('loading') // loading | login | home | session | words | browse | friends
  const [isSprint, setIsSprint] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)
  const [sessionMode, setSessionMode] = useState('normal') // 'normal' | 'reviewQuiz' | 'learningQuiz'
  const [browseCategory, setBrowseCategory] = useState(null) // { title, words, color }
  const [showWelcome, setShowWelcome] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

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
      // Load unread message count (non-blocking)
      getUnreadCount(userId).then(c => setUnreadCount(c)).catch(() => {})
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
      <Spinner text="Loading..." />
    </div>
  )

  if (screen === 'login') return <LoginScreen onAuthComplete={handleAuthComplete} />

  if (!profile) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner text="Loading your progress..." />
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
        else if (action === 'friends') { setScreen('friends') }
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

  if (screen === 'friends') return (
    <FriendsScreen
      userId={authUser.id}
      onBack={() => { setScreen('home'); getUnreadCount(authUser.id).then(c => setUnreadCount(c)).catch(() => {}) }}
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
      userId={authUser.id}
      onStartSession={startSession}
      onLogout={handleLogout}
      onShowHowItWorks={() => setShowWelcome('howItWorks')}
      onFriends={() => setScreen('friends')}
      unreadCount={unreadCount}
    />
  )
}
