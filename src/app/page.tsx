'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 480
const CANVAS_H = 640

// Bird
const BIRD_X = 80
const BIRD_R = 18
const GRAVITY = 0.35          // reduced from ~0.6 for more floaty feel
const JUMP_VY = -7.5          // reduced magnitude for gentler jump
const MAX_FALL = 10           // terminal velocity

// Pipes
const PIPE_W = 60
const PIPE_GAP = 170          // vertical gap between top and bottom pipe
const PIPE_SPEED = 2.2        // reduced from ~3.5 for more manageable speed
const PIPE_INTERVAL = 1800    // ms between new pipes

// ─── Types ────────────────────────────────────────────────────────────────────
interface Pipe {
  x: number
  gapY: number   // center of the gap
  scored: boolean
}

interface RankEntry {
  player_name: string
  best_score: number
}

type GameState = 'idle' | 'playing' | 'dead' | 'enter_name'

// ─── DB helpers (client-side PGLite) ──────────────────────────────────────────
let dbPromise: Promise<import('@electric-sql/pglite').PGlite> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { PGlite } = await import('@electric-sql/pglite')
      const db = new PGlite('./data/flappy.db')
      await db.exec(`
        CREATE TABLE IF NOT EXISTS scores (
          id SERIAL PRIMARY KEY,
          player_name TEXT NOT NULL,
          score INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `)
      return db
    })()
  }
  return dbPromise
}

async function saveScore(name: string, score: number) {
  const db = await getDB()
  await db.query('INSERT INTO scores (player_name, score) VALUES ($1, $2)', [name, score])
}

async function getLeaderboard(): Promise<RankEntry[]> {
  const db = await getDB()
  // Group by player_name, keep only best score per player, top 10
  const result = await db.query<{ player_name: string; best_score: number }>(`
    SELECT player_name, MAX(score) AS best_score
    FROM scores
    GROUP BY player_name
    ORDER BY best_score DESC
    LIMIT 10
  `)
  return result.rows
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────
function drawBird(ctx: CanvasRenderingContext2D, y: number, vy: number) {
  const tilt = Math.min(Math.max(vy * 3, -30), 70) * (Math.PI / 180)
  ctx.save()
  ctx.translate(BIRD_X, y)
  ctx.rotate(tilt)

  // Body
  ctx.fillStyle = '#FFD700'
  ctx.beginPath()
  ctx.ellipse(0, 0, BIRD_R, BIRD_R - 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Wing
  ctx.fillStyle = '#FFA500'
  ctx.beginPath()
  ctx.ellipse(-4, 4, 10, 6, -0.4, 0, Math.PI * 2)
  ctx.fill()

  // Eye
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(7, -5, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(8.5, -5, 2.5, 0, Math.PI * 2)
  ctx.fill()

  // Beak
  ctx.fillStyle = '#FF6B00'
  ctx.beginPath()
  ctx.moveTo(13, -2)
  ctx.lineTo(20, 0)
  ctx.lineTo(13, 3)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

function drawPipes(ctx: CanvasRenderingContext2D, pipes: Pipe[]) {
  pipes.forEach(pipe => {
    const topH = pipe.gapY - PIPE_GAP / 2
    const botY = pipe.gapY + PIPE_GAP / 2
    const botH = CANVAS_H - botY

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 8

    // Top pipe
    const gradTop = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_W, 0)
    gradTop.addColorStop(0, '#2ecc40')
    gradTop.addColorStop(0.5, '#44d958')
    gradTop.addColorStop(1, '#1a8c28')
    ctx.fillStyle = gradTop
    ctx.fillRect(pipe.x, 0, PIPE_W, topH)

    // Top pipe cap
    ctx.fillStyle = '#27ae34'
    ctx.fillRect(pipe.x - 5, topH - 20, PIPE_W + 10, 20)

    // Bottom pipe
    const gradBot = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_W, 0)
    gradBot.addColorStop(0, '#2ecc40')
    gradBot.addColorStop(0.5, '#44d958')
    gradBot.addColorStop(1, '#1a8c28')
    ctx.fillStyle = gradBot
    ctx.fillRect(pipe.x, botY, PIPE_W, botH)

    // Bottom pipe cap
    ctx.fillStyle = '#27ae34'
    ctx.fillRect(pipe.x - 5, botY, PIPE_W + 10, 20)

    ctx.shadowBlur = 0
  })
}

function drawBackground(ctx: CanvasRenderingContext2D, bgOffset: number) {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  sky.addColorStop(0, '#4dc8f5')
  sky.addColorStop(1, '#b8eaff')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Clouds (simple)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  const cloudPositions = [60, 200, 340]
  cloudPositions.forEach((baseX, i) => {
    const cx = ((baseX - bgOffset * 0.3 * (i + 1) * 0.5) % (CANVAS_W + 100) + CANVAS_W + 100) % (CANVAS_W + 100) - 50
    const cy = 80 + i * 60
    ctx.beginPath()
    ctx.arc(cx, cy, 28, 0, Math.PI * 2)
    ctx.arc(cx + 22, cy - 8, 20, 0, Math.PI * 2)
    ctx.arc(cx + 40, cy, 22, 0, Math.PI * 2)
    ctx.fill()
  })

  // Ground
  ctx.fillStyle = '#8B5E3C'
  ctx.fillRect(0, CANVAS_H - 30, CANVAS_W, 30)
  ctx.fillStyle = '#5C8A1E'
  ctx.fillRect(0, CANVAS_H - 30, CANVAS_W, 12)
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>('idle')
  const birdYRef = useRef(CANVAS_H / 2)
  const birdVYRef = useRef(0)
  const pipesRef = useRef<Pipe[]>([])
  const scoreRef = useRef(0)
  const bgOffsetRef = useRef(0)
  const lastPipeTimeRef = useRef(0)
  const animFrameRef = useRef(0)
  const lastTimeRef = useRef(0)

  const [gameState, setGameState] = useState<GameState>('idle')
  const [displayScore, setDisplayScore] = useState(0)
  const [finalScore, setFinalScore] = useState(0)
  const [playerName, setPlayerName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [leaderboard, setLeaderboard] = useState<RankEntry[]>([])
  const [showBoard, setShowBoard] = useState(false)
  const [savingScore, setSavingScore] = useState(false)

  const fetchLeaderboard = useCallback(async () => {
    const rows = await getLeaderboard()
    setLeaderboard(rows)
  }, [])

  // ── Game loop ────────────────────────────────────────────────────────────────
  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const dt = lastTimeRef.current ? Math.min((timestamp - lastTimeRef.current) / 16.67, 3) : 1
    lastTimeRef.current = timestamp

    const state = stateRef.current

    // ── Physics (only when playing) ──────────────────────────────────────────
    if (state === 'playing') {
      // Bird physics
      birdVYRef.current = Math.min(birdVYRef.current + GRAVITY * dt, MAX_FALL)
      birdYRef.current += birdVYRef.current * dt

      // Background scroll
      bgOffsetRef.current += PIPE_SPEED * dt * 0.5

      // Pipes
      const now = timestamp
      if (now - lastPipeTimeRef.current > PIPE_INTERVAL) {
        const minGapY = 140
        const maxGapY = CANVAS_H - 140
        const gapY = minGapY + Math.random() * (maxGapY - minGapY)
        pipesRef.current.push({ x: CANVAS_W + 10, gapY, scored: false })
        lastPipeTimeRef.current = now
      }

      pipesRef.current = pipesRef.current
        .map(p => ({ ...p, x: p.x - PIPE_SPEED * dt }))
        .filter(p => p.x + PIPE_W > -10)

      // Scoring
      pipesRef.current.forEach(p => {
        if (!p.scored && p.x + PIPE_W < BIRD_X) {
          p.scored = true
          scoreRef.current += 1
          setDisplayScore(scoreRef.current)
        }
      })

      // Collision detection
      const bx = BIRD_X
      const by = birdYRef.current
      const br = BIRD_R - 3 // slight forgiveness

      // Ground / ceiling
      if (by + br >= CANVAS_H - 30 || by - br <= 0) {
        stateRef.current = 'dead'
        setGameState('dead')
        setFinalScore(scoreRef.current)
      }

      // Pipes
      for (const p of pipesRef.current) {
        if (bx + br > p.x && bx - br < p.x + PIPE_W) {
          const topH = p.gapY - PIPE_GAP / 2
          const botY = p.gapY + PIPE_GAP / 2
          if (by - br < topH || by + br > botY) {
            stateRef.current = 'dead'
            setGameState('dead')
            setFinalScore(scoreRef.current)
          }
        }
      }
    }

    // ── Draw ─────────────────────────────────────────────────────────────────
    drawBackground(ctx, bgOffsetRef.current)
    drawPipes(ctx, pipesRef.current)
    drawBird(ctx, birdYRef.current, birdVYRef.current)

    // Score overlay
    if (state === 'playing' || state === 'dead') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.beginPath()
      ctx.roundRect(CANVAS_W / 2 - 45, 18, 90, 44, 12)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 32px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(String(scoreRef.current), CANVAS_W / 2, 50)
    }

    animFrameRef.current = requestAnimationFrame(gameLoop)
  }, [])

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [gameLoop])

  // ── Input handlers ───────────────────────────────────────────────────────────
  const jump = useCallback(() => {
    if (stateRef.current === 'playing') {
      birdVYRef.current = JUMP_VY
    }
  }, [])

  const startGame = useCallback(() => {
    birdYRef.current = CANVAS_H / 2
    birdVYRef.current = 0
    pipesRef.current = []
    scoreRef.current = 0
    lastPipeTimeRef.current = 0
    lastTimeRef.current = 0
    setDisplayScore(0)
    stateRef.current = 'playing'
    setGameState('playing')
  }, [])

  const handleCanvasClick = useCallback(() => {
    const s = stateRef.current
    if (s === 'idle') {
      startGame()
    } else if (s === 'playing') {
      jump()
    }
  }, [startGame, jump])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      const s = stateRef.current
      if (s === 'idle') startGame()
      else if (s === 'playing') jump()
    }
  }, [startGame, jump])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── Save score flow ───────────────────────────────────────────────────────────
  const handleSubmitName = useCallback(async () => {
    const name = nameInput.trim()
    if (!name) return
    setSavingScore(true)
    await saveScore(name, finalScore)
    setPlayerName(name)
    await fetchLeaderboard()
    setSavingScore(false)
    setShowBoard(true)
    setNameInput('')
    stateRef.current = 'idle'
    setGameState('idle')
  }, [nameInput, finalScore, fetchLeaderboard])

  const handleViewBoard = useCallback(async () => {
    await fetchLeaderboard()
    setShowBoard(true)
  }, [fetchLeaderboard])

  const handleCloseBoard = useCallback(() => {
    setShowBoard(false)
  }, [])

  const handleSkipName = useCallback(() => {
    stateRef.current = 'idle'
    setGameState('idle')
  }, [])

  // ── Rank medal helper ─────────────────────────────────────────────────────────
  const medal = (i: number) => {
    if (i === 0) return '🥇'
    if (i === 1) return '🥈'
    if (i === 2) return '🥉'
    return `${i + 1}.`
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block"
          onClick={handleCanvasClick}
          style={{ cursor: gameState === 'playing' ? 'pointer' : 'default' }}
        />

        {/* IDLE overlay */}
        {gameState === 'idle' && !showBoard && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="bg-black/60 rounded-2xl px-10 py-8 flex flex-col items-center gap-4">
              <h1 className="text-yellow-400 text-5xl font-black tracking-tight drop-shadow">🐦 Flappy Bird</h1>
              <p className="text-white text-lg">Press <kbd className="bg-white/20 px-2 py-0.5 rounded">Space</kbd> or tap to start</p>
              <button
                onClick={startGame}
                className="mt-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-8 py-3 rounded-xl text-lg transition"
              >
                Play
              </button>
              <button
                onClick={handleViewBoard}
                className="bg-white/20 hover:bg-white/30 text-white font-semibold px-6 py-2 rounded-xl transition"
              >
                🏆 Leaderboard
              </button>
              {playerName && (
                <p className="text-green-300 text-sm">Welcome back, {playerName}!</p>
              )}
            </div>
          </div>
        )}

        {/* DEAD overlay */}
        {gameState === 'dead' && !showBoard && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="bg-black/70 rounded-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-[300px]">
              <h2 className="text-red-400 text-4xl font-black">Game Over</h2>
              <p className="text-white text-2xl font-bold">Score: <span className="text-yellow-400">{finalScore}</span></p>
              <div className="flex flex-col gap-2 w-full mt-2">
                <label className="text-white text-sm font-semibold">Enter your name for the leaderboard:</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmitName() }}
                  maxLength={20}
                  placeholder="Your name..."
                  className="bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/40 outline-none focus:border-yellow-400 transition"
                  autoFocus
                />
                <button
                  onClick={handleSubmitName}
                  disabled={!nameInput.trim() || savingScore}
                  className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-bold px-6 py-2 rounded-xl transition"
                >
                  {savingScore ? 'Saving...' : 'Save Score'}
                </button>
                <button
                  onClick={handleSkipName}
                  className="text-white/50 hover:text-white/80 text-sm transition"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LEADERBOARD overlay */}
        {showBoard && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="bg-black/80 rounded-2xl px-8 py-7 flex flex-col items-center gap-4 min-w-[320px] max-h-[560px] overflow-y-auto">
              <h2 className="text-yellow-400 text-3xl font-black">🏆 Leaderboard</h2>
              <p className="text-white/50 text-xs -mt-2">Best score per player</p>
              {leaderboard.length === 0 ? (
                <p className="text-white/60">No scores yet. Be the first!</p>
              ) : (
                <table className="w-full text-white">
                  <thead>
                    <tr className="text-white/50 text-sm border-b border-white/10">
                      <th className="pb-2 text-left w-10">#</th>
                      <th className="pb-2 text-left">Player</th>
                      <th className="pb-2 text-right">Best Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, i) => (
                      <tr
                        key={row.player_name}
                        className={`border-b border-white/5 ${
                          row.player_name === playerName ? 'text-yellow-300 font-bold' : ''
                        }`}
                      >
                        <td className="py-2 text-lg">{medal(i)}</td>
                        <td className="py-2">{row.player_name}</td>
                        <td className="py-2 text-right font-mono text-lg">{row.best_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button
                onClick={handleCloseBoard}
                className="mt-2 bg-white/20 hover:bg-white/30 text-white font-semibold px-8 py-2 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* In-game score */}
        {gameState === 'playing' && (
          <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
            {/* score drawn on canvas directly */}
          </div>
        )}
      </div>
    </div>
  )
}
