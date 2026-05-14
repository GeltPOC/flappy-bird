'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const BASE_PATH = '/flappy-bird'

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 600
const BIRD_X = 80
const BIRD_RADIUS = 16
const GRAVITY = 0.5
const JUMP_FORCE = -9
const PIPE_WIDTH = 60
const PIPE_GAP = 160
const PIPE_SPEED = 3
const PIPE_INTERVAL = 1600 // ms

interface Pipe {
  x: number
  topHeight: number
  passed: boolean
}

interface ScoreEntry {
  id: number
  player_name: string
  score: number
  created_at: string
}

type GameState = 'idle' | 'playing' | 'dead' | 'submitting'

export default function FlappyBirdPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const lastPipeTime = useRef<number>(0)

  const birdY = useRef<number>(CANVAS_HEIGHT / 2)
  const birdVel = useRef<number>(0)
  const pipes = useRef<Pipe[]>([])
  const score = useRef<number>(0)
  const gameStateRef = useRef<GameState>('idle')

  const [displayScore, setDisplayScore] = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([])
  const [playerName, setPlayerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [loadingBoard, setLoadingBoard] = useState(false)

  const setGameStateBoth = (s: GameState) => {
    gameStateRef.current = s
    setGameState(s)
  }

  const fetchLeaderboard = useCallback(async () => {
    setLoadingBoard(true)
    try {
      const res = await fetch(`${BASE_PATH}/api/scores`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLeaderboard(data.scores || [])
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e)
    } finally {
      setLoadingBoard(false)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Sky
    ctx.fillStyle = '#70c5ce'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Ground
    ctx.fillStyle = '#ded895'
    ctx.fillRect(0, CANVAS_HEIGHT - 60, CANVAS_WIDTH, 60)
    ctx.fillStyle = '#5d9b3f'
    ctx.fillRect(0, CANVAS_HEIGHT - 62, CANVAS_WIDTH, 6)

    // Pipes
    ctx.fillStyle = '#5d9b3f'
    for (const pipe of pipes.current) {
      // Top pipe
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight)
      ctx.fillStyle = '#4a7f30'
      ctx.fillRect(pipe.x - 4, pipe.topHeight - 20, PIPE_WIDTH + 8, 20)
      ctx.fillStyle = '#5d9b3f'
      // Bottom pipe
      const botY = pipe.topHeight + PIPE_GAP
      ctx.fillRect(pipe.x, botY, PIPE_WIDTH, CANVAS_HEIGHT - botY)
      ctx.fillStyle = '#4a7f30'
      ctx.fillRect(pipe.x - 4, botY, PIPE_WIDTH + 8, 20)
      ctx.fillStyle = '#5d9b3f'
    }

    // Bird
    const by = birdY.current
    ctx.save()
    ctx.translate(BIRD_X, by)
    const angle = Math.max(-0.5, Math.min(1.0, birdVel.current * 0.08))
    ctx.rotate(angle)
    // Body
    ctx.fillStyle = '#f7c948'
    ctx.beginPath()
    ctx.ellipse(0, 0, BIRD_RADIUS, BIRD_RADIUS - 2, 0, 0, Math.PI * 2)
    ctx.fill()
    // Wing
    ctx.fillStyle = '#e6a800'
    ctx.beginPath()
    ctx.ellipse(-4, 4, 8, 5, -0.3, 0, Math.PI * 2)
    ctx.fill()
    // Eye
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(6, -4, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(8, -4, 2.5, 0, Math.PI * 2)
    ctx.fill()
    // Beak
    ctx.fillStyle = '#e67e22'
    ctx.beginPath()
    ctx.moveTo(12, -1)
    ctx.lineTo(20, 2)
    ctx.lineTo(12, 5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // Score
    ctx.fillStyle = 'white'
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 3
    ctx.font = 'bold 36px Arial'
    ctx.textAlign = 'center'
    ctx.strokeText(String(score.current), CANVAS_WIDTH / 2, 60)
    ctx.fillText(String(score.current), CANVAS_WIDTH / 2, 60)

    // Overlay messages
    if (gameStateRef.current === 'idle') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.fillStyle = 'white'
      ctx.font = 'bold 44px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('FLAPPY BIRD', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30)
      ctx.font = '22px Arial'
      ctx.fillText('Press SPACE or tap to start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
    }

    if (gameStateRef.current === 'dead') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.fillStyle = '#ff4444'
      ctx.font = 'bold 44px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20)
      ctx.fillStyle = 'white'
      ctx.font = '24px Arial'
      ctx.fillText(`Score: ${score.current}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 24)
    }
  }, [])

  const resetGame = useCallback(() => {
    birdY.current = CANVAS_HEIGHT / 2
    birdVel.current = 0
    pipes.current = []
    score.current = 0
    lastPipeTime.current = 0
    setDisplayScore(0)
    setSubmitError('')
  }, [])

  const jump = useCallback(() => {
    if (gameStateRef.current === 'idle') {
      resetGame()
      setGameStateBoth('playing')
      birdVel.current = JUMP_FORCE
      return
    }
    if (gameStateRef.current === 'playing') {
      birdVel.current = JUMP_FORCE
    }
  }, [resetGame])

  // Game loop
  useEffect(() => {
    let lastTime = 0

    const loop = (timestamp: number) => {
      if (gameStateRef.current === 'playing') {
        const dt = lastTime ? Math.min(timestamp - lastTime, 50) : 16
        lastTime = timestamp

        // Physics
        birdVel.current += GRAVITY
        birdY.current += birdVel.current

        // Spawn pipes
        if (lastPipeTime.current === 0 || timestamp - lastPipeTime.current > PIPE_INTERVAL) {
          const topHeight = 80 + Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 140)
          pipes.current.push({ x: CANVAS_WIDTH + 10, topHeight, passed: false })
          lastPipeTime.current = timestamp
        }

        // Move pipes
        pipes.current = pipes.current.map(p => ({ ...p, x: p.x - PIPE_SPEED }))
        pipes.current = pipes.current.filter(p => p.x > -PIPE_WIDTH - 10)

        // Score
        for (const pipe of pipes.current) {
          if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
            pipe.passed = true
            score.current += 1
            setDisplayScore(score.current)
          }
        }

        // Collision: ground / ceiling
        if (birdY.current + BIRD_RADIUS >= CANVAS_HEIGHT - 60 || birdY.current - BIRD_RADIUS <= 0) {
          setGameStateBoth('dead')
        }

        // Collision: pipes
        for (const pipe of pipes.current) {
          if (
            BIRD_X + BIRD_RADIUS > pipe.x + 4 &&
            BIRD_X - BIRD_RADIUS < pipe.x + PIPE_WIDTH - 4
          ) {
            if (
              birdY.current - BIRD_RADIUS < pipe.topHeight ||
              birdY.current + BIRD_RADIUS > pipe.topHeight + PIPE_GAP
            ) {
              setGameStateBoth('dead')
            }
          }
        }
      } else {
        lastTime = 0
      }

      drawFrame()
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [drawFrame])

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        if (gameStateRef.current !== 'dead' && gameStateRef.current !== 'submitting') {
          jump()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [jump])

  const handleCanvasClick = () => {
    if (gameStateRef.current !== 'dead' && gameStateRef.current !== 'submitting') {
      jump()
    }
  }

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = playerName.trim()
    if (!name) {
      setSubmitError('Please enter your name.')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`${BASE_PATH}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: name, score: score.current })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      await fetchLeaderboard()
      setPlayerName('')
      setGameStateBoth('idle')
      resetGame()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setSubmitError(`Failed to save score: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    setGameStateBoth('idle')
    resetGame()
    setPlayerName('')
    setSubmitError('')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sky-400 py-6">
      <h1 className="text-3xl font-bold text-white mb-4 drop-shadow">Flappy Bird</h1>

      <div className="flex flex-col lg:flex-row gap-6 items-start justify-center w-full max-w-3xl px-4">
        {/* Game area */}
        <div className="flex flex-col items-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            className="rounded-xl shadow-2xl cursor-pointer border-4 border-white"
            style={{ display: 'block' }}
          />
          <p className="text-white mt-2 text-sm opacity-75">Click or press SPACE to flap</p>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4 w-full lg:w-64">
          {/* Score submit panel */}
          {gameState === 'dead' && (
            <div className="bg-white rounded-xl shadow-xl p-4">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Game Over!</h2>
              <p className="text-gray-600 mb-3">Your score: <span className="font-bold text-blue-600">{displayScore}</span></p>
              <form onSubmit={handleSubmitScore} className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Your name"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  maxLength={30}
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  disabled={submitting}
                />
                {submitError && <p className="text-red-500 text-xs">{submitError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Score'}
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={submitting}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded transition disabled:opacity-50 text-sm"
                >
                  Skip
                </button>
              </form>
            </div>
          )}

          {/* Leaderboard */}
          <div className="bg-white rounded-xl shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800">🏆 Leaderboard</h2>
              <button
                onClick={fetchLeaderboard}
                disabled={loadingBoard}
                className="text-xs text-blue-500 hover:underline disabled:opacity-50"
              >
                {loadingBoard ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            {leaderboard.length === 0 && !loadingBoard && (
              <p className="text-gray-400 text-sm text-center py-4">No scores yet. Be the first!</p>
            )}
            {loadingBoard && <p className="text-gray-400 text-sm text-center py-4">Loading...</p>}
            <ol className="space-y-1">
              {leaderboard.map((entry, idx) => (
                <li key={entry.id} className="flex items-center justify-between text-sm">
                  <span className={`font-bold w-6 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                    {idx + 1}.
                  </span>
                  <span className="flex-1 truncate text-gray-700 ml-1">{entry.player_name}</span>
                  <span className="font-bold text-blue-600 ml-2">{entry.score}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
