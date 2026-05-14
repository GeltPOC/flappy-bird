'use client'

import { useEffect, useRef, useState } from 'react'

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 600
const BIRD_X = 80
const BIRD_RADIUS = 18
const GRAVITY = 0.5
const JUMP_FORCE = -9
const PIPE_WIDTH = 60
const PIPE_GAP = 160
const PIPE_SPEED = 3
const PIPE_INTERVAL = 90

interface Pipe {
  x: number
  topHeight: number
}

interface GameState {
  birdY: number
  birdVelocity: number
  pipes: Pipe[]
  score: number
  frameCount: number
  alive: boolean
  started: boolean
}

function createInitialState(): GameState {
  return {
    birdY: CANVAS_HEIGHT / 2,
    birdVelocity: 0,
    pipes: [],
    score: 0,
    frameCount: 0,
    alive: true,
    started: false,
  }
}

export default function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createInitialState())
  const animFrameRef = useRef<number>(0)
  const [displayScore, setDisplayScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)

  const jump = () => {
    const state = stateRef.current
    if (state.alive) {
      if (!state.started) {
        state.started = true
        setStarted(true)
      }
      state.birdVelocity = JUMP_FORCE
    }
  }

  const restart = () => {
    stateRef.current = createInitialState()
    setDisplayScore(0)
    setGameOver(false)
    setStarted(false)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        jump()
      }
    }
    window.addEventListener('keydown', handleKey)

    function drawBird(ctx: CanvasRenderingContext2D, y: number) {
      const x = BIRD_X
      const r = BIRD_RADIUS

      // Body - black
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = '#111111'
      ctx.fill()
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.stroke()

      // Wing - dark gray
      ctx.beginPath()
      ctx.ellipse(x - 4, y + 4, 10, 6, -0.4, 0, Math.PI * 2)
      ctx.fillStyle = '#333333'
      ctx.fill()

      // Eye white
      ctx.beginPath()
      ctx.arc(x + 7, y - 5, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      // Pupil
      ctx.beginPath()
      ctx.arc(x + 9, y - 5, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#000000'
      ctx.fill()

      // Beak
      ctx.beginPath()
      ctx.moveTo(x + r - 2, y)
      ctx.lineTo(x + r + 10, y - 3)
      ctx.lineTo(x + r + 10, y + 3)
      ctx.closePath()
      ctx.fillStyle = '#555555'
      ctx.fill()
    }

    function drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe) {
      const gapStart = pipe.topHeight
      const gapEnd = pipe.topHeight + PIPE_GAP

      // Top pipe
      ctx.fillStyle = '#2ecc40'
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, gapStart)
      ctx.fillStyle = '#27ae60'
      ctx.fillRect(pipe.x - 4, gapStart - 28, PIPE_WIDTH + 8, 28)

      // Bottom pipe
      ctx.fillStyle = '#2ecc40'
      ctx.fillRect(pipe.x, gapEnd, PIPE_WIDTH, CANVAS_HEIGHT - gapEnd)
      ctx.fillStyle = '#27ae60'
      ctx.fillRect(pipe.x - 4, gapEnd, PIPE_WIDTH + 8, 28)
    }

    function drawBackground(ctx: CanvasRenderingContext2D) {
      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
      grad.addColorStop(0, '#70c5ce')
      grad.addColorStop(1, '#a8e6f0')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Ground
      ctx.fillStyle = '#ded895'
      ctx.fillRect(0, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 30)
      ctx.fillStyle = '#5d8a3c'
      ctx.fillRect(0, CANVAS_HEIGHT - 35, CANVAS_WIDTH, 8)
    }

    function checkCollision(state: GameState): boolean {
      const birdTop = state.birdY - BIRD_RADIUS
      const birdBottom = state.birdY + BIRD_RADIUS
      const birdLeft = BIRD_X - BIRD_RADIUS
      const birdRight = BIRD_X + BIRD_RADIUS

      // Ground / ceiling
      if (birdBottom >= CANVAS_HEIGHT - 30 || birdTop <= 0) return true

      for (const pipe of state.pipes) {
        if (birdRight > pipe.x + 4 && birdLeft < pipe.x + PIPE_WIDTH - 4) {
          if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + PIPE_GAP) {
            return true
          }
        }
      }
      return false
    }

    function gameLoop() {
      const state = stateRef.current
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Update
      if (state.started && state.alive) {
        state.birdVelocity += GRAVITY
        state.birdY += state.birdVelocity
        state.frameCount++

        // Spawn pipes
        if (state.frameCount % PIPE_INTERVAL === 0) {
          const minH = 60
          const maxH = CANVAS_HEIGHT - PIPE_GAP - 60 - 30
          const topHeight = Math.floor(Math.random() * (maxH - minH + 1)) + minH
          state.pipes.push({ x: CANVAS_WIDTH, topHeight })
        }

        // Move pipes
        for (const pipe of state.pipes) {
          pipe.x -= PIPE_SPEED
        }

        // Remove off-screen pipes & update score
        const before = state.pipes.length
        state.pipes = state.pipes.filter(p => p.x + PIPE_WIDTH > 0)
        const removed = before - state.pipes.length
        if (removed > 0) {
          state.score += removed
          setDisplayScore(state.score)
        }

        // Score when passing pipe center
        for (const pipe of state.pipes) {
          if (pipe.x + PIPE_WIDTH / 2 === BIRD_X - 1) {
            // handled by removal above for simplicity
          }
        }

        if (checkCollision(state)) {
          state.alive = false
          setGameOver(true)
        }
      }

      // Draw
      drawBackground(ctx)
      for (const pipe of state.pipes) {
        drawPipe(ctx, pipe)
      }
      drawBird(ctx, state.birdY)

      // Score text
      ctx.fillStyle = 'white'
      ctx.font = 'bold 32px Arial'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 4
      ctx.fillText(String(state.score), CANVAS_WIDTH / 2, 50)
      ctx.shadowBlur = 0

      animFrameRef.current = requestAnimationFrame(gameLoop)
    }

    animFrameRef.current = requestAnimationFrame(gameLoop)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <h1 className="text-white text-3xl font-bold mb-4">Flappy Bird</h1>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-lg shadow-2xl cursor-pointer"
          onClick={jump}
        />
        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-40 rounded-lg">
            <p className="text-white text-2xl font-bold mb-2">Flappy Bird</p>
            <p className="text-white text-lg">Click or press Space to start</p>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 rounded-lg">
            <p className="text-white text-3xl font-bold mb-2">Game Over</p>
            <p className="text-white text-xl mb-6">Score: {displayScore}</p>
            <button
              onClick={restart}
              className="px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-full text-lg transition-colors"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
      <p className="text-gray-400 mt-4 text-sm">Click, tap or press Space / ↑ to flap</p>
    </div>
  )
}
