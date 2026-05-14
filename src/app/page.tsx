'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const BASE_PATH = '/flappy-bird'
const CANVAS_W = 400
const CANVAS_H = 600
const BIRD_X = 80
const BIRD_SIZE = 28
const GRAVITY = 0.5
const FLAP_FORCE = -9
const PIPE_W = 60
const PIPE_GAP = 160
const PIPE_SPEED = 3
const PIPE_INTERVAL = 1600 // ms

type Screen = 'name' | 'playing' | 'dead' | 'ranking'

interface ScoreEntry {
  id: number
  player_name: string
  score: number
  created_at: string
}

interface Pipe {
  x: number
  topH: number
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('name')
  const [playerName, setPlayerName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [finalScore, setFinalScore] = useState(0)
  const [rankings, setRankings] = useState<ScoreEntry[]>([])
  const [rankingsLoading, setRankingsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef({
    birdY: CANVAS_H / 2,
    birdVY: 0,
    pipes: [] as Pipe[],
    score: 0,
    running: false,
    lastPipe: 0,
    frame: 0,
    animId: 0,
  })
  const keyCBRef = useRef<((e: KeyboardEvent) => void) | null>(null)

  const loadRankings = useCallback(async () => {
    setRankingsLoading(true)
    try {
      const res = await fetch(`${BASE_PATH}/api/scores`)
      const data = await res.json()
      setRankings(data.scores || [])
    } catch {
      setRankings([])
    } finally {
      setRankingsLoading(false)
    }
  }, [])

  const saveScore = useCallback(async (name: string, score: number) => {
    setSaving(true)
    try {
      await fetch(`${BASE_PATH}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: name, score }),
      })
    } catch {}
    finally { setSaving(false) }
  }, [])

  const flap = useCallback(() => {
    if (!gameRef.current.running) return
    gameRef.current.birdVY = FLAP_FORCE
  }, [])

  const startGame = useCallback(() => {
    const g = gameRef.current
    g.birdY = CANVAS_H / 2
    g.birdVY = 0
    g.pipes = []
    g.score = 0
    g.running = true
    g.lastPipe = performance.now()
    g.frame = 0
    setScreen('playing')
  }, [])

  const endGame = useCallback(async (score: number, name: string) => {
    gameRef.current.running = false
    setFinalScore(score)
    setScreen('dead')
    await saveScore(name, score)
  }, [saveScore])

  // Game loop
  useEffect(() => {
    if (screen !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const g = gameRef.current
    let currentPlayerName = playerName

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') flap()
    }
    keyCBRef.current = handleKey
    window.addEventListener('keydown', handleKey)

    let bgOffset = 0

    function drawBird(y: number) {
      // Body
      ctx.fillStyle = '#FFD700'
      ctx.beginPath()
      ctx.ellipse(BIRD_X, y, BIRD_SIZE / 2, BIRD_SIZE / 2 - 2, 0, 0, Math.PI * 2)
      ctx.fill()
      // Wing
      ctx.fillStyle = '#FFA500'
      ctx.beginPath()
      ctx.ellipse(BIRD_X - 4, y + 4, 8, 5, -0.4, 0, Math.PI * 2)
      ctx.fill()
      // Eye
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(BIRD_X + 7, y - 5, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#222'
      ctx.beginPath()
      ctx.arc(BIRD_X + 8, y - 5, 2.5, 0, Math.PI * 2)
      ctx.fill()
      // Beak
      ctx.fillStyle = '#FF6600'
      ctx.beginPath()
      ctx.moveTo(BIRD_X + 11, y - 1)
      ctx.lineTo(BIRD_X + 20, y + 2)
      ctx.lineTo(BIRD_X + 11, y + 5)
      ctx.closePath()
      ctx.fill()
    }

    function drawPipe(pipe: Pipe) {
      const grad1 = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_W, 0)
      grad1.addColorStop(0, '#3a7d00')
      grad1.addColorStop(0.4, '#5cb800')
      grad1.addColorStop(1, '#2d6000')
      ctx.fillStyle = grad1
      // Top pipe
      ctx.fillRect(pipe.x, 0, PIPE_W, pipe.topH)
      // Top cap
      ctx.fillStyle = '#4caf00'
      ctx.fillRect(pipe.x - 5, pipe.topH - 20, PIPE_W + 10, 20)
      // Bottom pipe
      const botY = pipe.topH + PIPE_GAP
      ctx.fillStyle = grad1
      ctx.fillRect(pipe.x, botY, PIPE_W, CANVAS_H - botY)
      // Bottom cap
      ctx.fillStyle = '#4caf00'
      ctx.fillRect(pipe.x - 5, botY, PIPE_W + 10, 20)
    }

    function loop(now: number) {
      if (!g.running) return
      g.frame++

      // Background sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
      skyGrad.addColorStop(0, '#70c5ce')
      skyGrad.addColorStop(1, '#b8eaf0')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      // Scrolling clouds (simple)
      bgOffset = (bgOffset + 0.5) % CANVAS_W
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      for (let i = 0; i < 3; i++) {
        const cx = ((i * 140 + CANVAS_W - bgOffset) % CANVAS_W)
        ctx.beginPath()
        ctx.ellipse(cx, 80 + i * 60, 40, 20, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(cx + 25, 70 + i * 60, 30, 18, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Ground
      ctx.fillStyle = '#c8a96e'
      ctx.fillRect(0, CANVAS_H - 60, CANVAS_W, 60)
      ctx.fillStyle = '#8BC34A'
      ctx.fillRect(0, CANVAS_H - 60, CANVAS_W, 12)

      // Spawn pipes
      if (now - g.lastPipe > PIPE_INTERVAL) {
        const topH = 80 + Math.random() * (CANVAS_H - 60 - PIPE_GAP - 80)
        g.pipes.push({ x: CANVAS_W, topH })
        g.lastPipe = now
      }

      // Update & draw pipes
      for (let i = g.pipes.length - 1; i >= 0; i--) {
        g.pipes[i].x -= PIPE_SPEED
        if (g.pipes[i].x + PIPE_W < 0) {
          g.pipes.splice(i, 1)
          continue
        }
        drawPipe(g.pipes[i])
        // Score
        if (g.pipes[i].x + PIPE_W === BIRD_X - BIRD_SIZE / 2) {
          g.score++
        }
        // Score (continuous check)
        if (
          g.pipes[i].x + PIPE_W < BIRD_X - BIRD_SIZE / 2 + PIPE_SPEED &&
          g.pipes[i].x + PIPE_W >= BIRD_X - BIRD_SIZE / 2
        ) {
          g.score++
        }
      }

      // Bird physics
      g.birdVY += GRAVITY
      g.birdY += g.birdVY

      drawBird(g.birdY)

      // Collision: ground / ceiling
      if (g.birdY + BIRD_SIZE / 2 >= CANVAS_H - 60 || g.birdY - BIRD_SIZE / 2 <= 0) {
        endGame(g.score, currentPlayerName)
        return
      }

      // Collision: pipes
      for (const pipe of g.pipes) {
        const bLeft = BIRD_X - BIRD_SIZE / 2 + 4
        const bRight = BIRD_X + BIRD_SIZE / 2 - 4
        const bTop = g.birdY - BIRD_SIZE / 2 + 4
        const bBot = g.birdY + BIRD_SIZE / 2 - 4
        if (bRight > pipe.x && bLeft < pipe.x + PIPE_W) {
          if (bTop < pipe.topH || bBot > pipe.topH + PIPE_GAP) {
            endGame(g.score, currentPlayerName)
            return
          }
        }
      }

      // Score display
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 36px Arial'
      ctx.textAlign = 'center'
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 3
      ctx.strokeText(String(g.score), CANVAS_W / 2, 60)
      ctx.fillText(String(g.score), CANVAS_W / 2, 60)

      // Player name
      ctx.font = '16px Arial'
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.textAlign = 'left'
      ctx.fillText(currentPlayerName, 10, 30)

      g.animId = requestAnimationFrame(loop)
    }

    g.animId = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('keydown', handleKey)
      cancelAnimationFrame(g.animId)
    }
  }, [screen, playerName, flap, endGame])

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = nameInput.trim()
    if (!name) return
    setPlayerName(name)
    startGame()
  }

  const handleShowRanking = async () => {
    setScreen('ranking')
    await loadRankings()
  }

  const handlePlayAgain = () => {
    startGame()
  }

  const handleBackToName = () => {
    setNameInput('')
    setScreen('name')
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-black">
      {/* Canvas always mounted but only visible during playing */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={flap}
        style={{ display: screen === 'playing' ? 'block' : 'none', cursor: 'pointer', touchAction: 'none' }}
      />

      {screen === 'name' && (
        <div className="flex flex-col items-center gap-6 bg-gradient-to-b from-sky-400 to-sky-200 rounded-2xl p-10 shadow-2xl w-[340px]">
          <div className="text-5xl">🐦</div>
          <h1 className="text-3xl font-bold text-white drop-shadow-md">Flappy Bird</h1>
          <form onSubmit={handleNameSubmit} className="flex flex-col gap-4 w-full">
            <label className="text-white font-semibold text-center">¿Cuál es tu nombre?</label>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Tu nombre..."
              maxLength={20}
              autoFocus
              className="px-4 py-2 rounded-xl text-center text-lg border-2 border-sky-600 focus:outline-none focus:border-yellow-400"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-gray-800 font-bold py-2 rounded-xl text-lg transition"
            >
              ¡Jugar!
            </button>
          </form>
          <button
            onClick={handleShowRanking}
            className="text-white underline text-sm opacity-80 hover:opacity-100 transition"
          >
            🏆 Ver Ranking
          </button>
        </div>
      )}

      {screen === 'dead' && (
        <div className="flex flex-col items-center gap-5 bg-gradient-to-b from-red-700 to-red-500 rounded-2xl p-10 shadow-2xl w-[340px]">
          <div className="text-5xl">💀</div>
          <h2 className="text-3xl font-bold text-white drop-shadow">¡Game Over!</h2>
          <div className="text-white text-center">
            <p className="text-lg">Jugador: <span className="font-bold">{playerName}</span></p>
            <p className="text-4xl font-bold mt-2">{finalScore}</p>
            <p className="text-sm opacity-75">puntos</p>
          </div>
          {saving && <p className="text-yellow-200 text-sm animate-pulse">Guardando puntaje...</p>}
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handlePlayAgain}
              className="bg-yellow-400 hover:bg-yellow-300 text-gray-800 font-bold py-2 rounded-xl text-lg transition"
            >
              🔄 Jugar de nuevo
            </button>
            <button
              onClick={handleShowRanking}
              className="bg-white/20 hover:bg-white/30 text-white font-bold py-2 rounded-xl text-lg transition"
            >
              🏆 Ver Ranking
            </button>
            <button
              onClick={handleBackToName}
              className="text-white/70 hover:text-white text-sm underline transition"
            >
              Cambiar jugador
            </button>
          </div>
        </div>
      )}

      {screen === 'ranking' && (
        <div className="flex flex-col items-center gap-4 bg-gradient-to-b from-indigo-700 to-indigo-500 rounded-2xl p-8 shadow-2xl w-[380px] max-h-[90vh]">
          <div className="text-4xl">🏆</div>
          <h2 className="text-3xl font-bold text-white drop-shadow">Ranking</h2>
          {rankingsLoading ? (
            <p className="text-white animate-pulse">Cargando...</p>
          ) : rankings.length === 0 ? (
            <p className="text-white/70 text-sm">Aún no hay puntajes.</p>
          ) : (
            <div className="w-full overflow-y-auto max-h-[380px]">
              <table className="w-full text-white">
                <thead>
                  <tr className="border-b border-white/30">
                    <th className="text-left py-2 pl-2 text-sm opacity-70">#</th>
                    <th className="text-left py-2 text-sm opacity-70">Jugador</th>
                    <th className="text-right py-2 pr-2 text-sm opacity-70">Puntaje</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-white/10 ${
                        idx === 0 ? 'bg-yellow-400/20' : idx === 1 ? 'bg-gray-300/10' : idx === 2 ? 'bg-orange-400/10' : ''
                      }`}
                    >
                      <td className="py-2 pl-2 text-lg font-bold">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </td>
                      <td className="py-2 font-semibold truncate max-w-[160px]">{entry.player_name}</td>
                      <td className="py-2 pr-2 text-right font-bold text-yellow-300">{entry.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-3 w-full">
            <button
              onClick={() => { setNameInput(playerName); setScreen(playerName ? 'name' : 'name') }}
              className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-gray-800 font-bold py-2 rounded-xl transition"
            >
              🎮 Jugar
            </button>
            <button
              onClick={loadRankings}
              className="bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-xl transition"
            >
              🔄
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
