'use client'

import { useEffect, useRef, useCallback } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────
const W = 480
const H = 640
const GRAVITY = 0.5
const JUMP_FORCE = -9
const PIPE_WIDTH = 60
const PIPE_GAP = 155
const PIPE_SPEED = 2.8
const PIPE_INTERVAL = 1600 // ms
const BIRD_SIZE = 34
const GROUND_H = 80

// ── Types ──────────────────────────────────────────────────────────────────
interface Bird {
  x: number
  y: number
  vy: number
  angle: number
}

interface Pipe {
  x: number
  topH: number
  scored: boolean
}

type GameState = 'idle' | 'playing' | 'dead'

interface GameData {
  state: GameState
  bird: Bird
  pipes: Pipe[]
  score: number
  bestScore: number
  lastPipeTime: number
  frameId: number
  lastTime: number
  deathTimer: number
}

// ── Helpers ────────────────────────────────────────────────────────────────
function makeBird(): Bird {
  return { x: 100, y: H / 2 - 40, vy: 0, angle: 0 }
}

function makeGameData(bestScore = 0): GameData {
  return {
    state: 'idle',
    bird: makeBird(),
    pipes: [],
    score: 0,
    bestScore,
    lastPipeTime: 0,
    frameId: 0,
    lastTime: 0,
    deathTimer: 0
  }
}

function randomPipe(): Pipe {
  const minTop = 60
  const maxTop = H - GROUND_H - PIPE_GAP - 60
  const topH = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop
  return { x: W + 20, topH, scored: false }
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

function checkCollision(bird: Bird, pipes: Pipe[]): boolean {
  const bx = bird.x - BIRD_SIZE / 2 + 4
  const by = bird.y - BIRD_SIZE / 2 + 4
  const bs = BIRD_SIZE - 8

  // Ground / ceiling
  if (bird.y + BIRD_SIZE / 2 >= H - GROUND_H) return true
  if (bird.y - BIRD_SIZE / 2 <= 0) return true

  for (const p of pipes) {
    // Top pipe
    if (rectsOverlap(bx, by, bs, bs, p.x, 0, PIPE_WIDTH, p.topH)) return true
    // Bottom pipe
    const botY = p.topH + PIPE_GAP
    if (rectsOverlap(bx, by, bs, bs, p.x, botY, PIPE_WIDTH, H - botY)) return true
  }
  return false
}

// ── Drawing ────────────────────────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D) {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H - GROUND_H)
  skyGrad.addColorStop(0, '#70c5ce')
  skyGrad.addColorStop(1, '#a8e6f0')
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, W, H - GROUND_H)

  // Clouds (static decorative)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  drawCloud(ctx, 60, 80, 50)
  drawCloud(ctx, 220, 120, 40)
  drawCloud(ctx, 370, 70, 55)
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2)
  ctx.arc(x + r * 0.5, y - r * 0.15, r * 0.45, 0, Math.PI * 2)
  ctx.arc(x + r, y, r * 0.55, 0, Math.PI * 2)
  ctx.arc(x + r * 0.5, y + r * 0.25, r * 0.5, 0, Math.PI * 2)
  ctx.fill()
}

function drawGround(ctx: CanvasRenderingContext2D) {
  const groundY = H - GROUND_H
  // Dirt
  ctx.fillStyle = '#ded895'
  ctx.fillRect(0, groundY, W, GROUND_H)
  // Grass strip
  ctx.fillStyle = '#5db832'
  ctx.fillRect(0, groundY, W, 14)
  // Darker grass line
  ctx.fillStyle = '#4a9429'
  ctx.fillRect(0, groundY + 14, W, 4)
}

function drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe) {
  const capW = PIPE_WIDTH + 10
  const capH = 26
  const capX = pipe.x - 5

  // Top pipe body
  const topGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0)
  topGrad.addColorStop(0, '#3aaa35')
  topGrad.addColorStop(0.35, '#5ecc5a')
  topGrad.addColorStop(0.7, '#3aaa35')
  topGrad.addColorStop(1, '#2a8026')
  ctx.fillStyle = topGrad
  ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topH - capH)

  // Top pipe cap
  ctx.fillStyle = '#3aaa35'
  ctx.fillRect(capX, pipe.topH - capH, capW, capH)
  ctx.fillStyle = '#5ecc5a'
  ctx.fillRect(capX, pipe.topH - capH, capW, 6)
  // Cap border
  ctx.strokeStyle = '#2a8026'
  ctx.lineWidth = 2
  ctx.strokeRect(capX, pipe.topH - capH, capW, capH)

  // Bottom pipe
  const botY = pipe.topH + PIPE_GAP
  const botBodyY = botY + capH
  const botBodyH = H - GROUND_H - botBodyY

  ctx.fillStyle = topGrad
  ctx.fillRect(pipe.x, botBodyY, PIPE_WIDTH, botBodyH)

  // Bottom pipe cap
  ctx.fillStyle = '#3aaa35'
  ctx.fillRect(capX, botY, capW, capH)
  ctx.fillStyle = '#2a8026'
  ctx.fillRect(capX, botY + capH - 6, capW, 6)
  ctx.strokeStyle = '#2a8026'
  ctx.lineWidth = 2
  ctx.strokeRect(capX, botY, capW, capH)
}

function drawBird(ctx: CanvasRenderingContext2D, bird: Bird, tick: number) {
  ctx.save()
  ctx.translate(bird.x, bird.y)
  ctx.rotate(bird.angle)

  const r = BIRD_SIZE / 2

  // Body
  ctx.fillStyle = '#ffd700'
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#c8a000'
  ctx.lineWidth = 2
  ctx.stroke()

  // Wing flap
  const flapOffset = Math.sin(tick * 0.3) * 5
  ctx.fillStyle = '#f0c000'
  ctx.beginPath()
  ctx.ellipse(-4, flapOffset, r * 0.55, r * 0.3, -0.4, 0, Math.PI * 2)
  ctx.fill()

  // Eye
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(r * 0.35, -r * 0.25, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(r * 0.45, -r * 0.22, 3.5, 0, Math.PI * 2)
  ctx.fill()
  // Shine
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(r * 0.52, -r * 0.3, 1.5, 0, Math.PI * 2)
  ctx.fill()

  // Beak
  ctx.fillStyle = '#ff8c00'
  ctx.beginPath()
  ctx.moveTo(r * 0.7, -r * 0.05)
  ctx.lineTo(r * 1.35, r * 0.08)
  ctx.lineTo(r * 0.7, r * 0.2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#cc5500'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.restore()
}

function drawScore(ctx: CanvasRenderingContext2D, score: number) {
  ctx.save()
  ctx.font = 'bold 52px Arial'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 3
  ctx.fillText(String(score), W / 2, 90)
  ctx.restore()
}

function drawIdleScreen(ctx: CanvasRenderingContext2D) {
  // Title panel
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(ctx, W / 2 - 150, H / 2 - 130, 300, 210, 16)
  ctx.fill()

  ctx.font = 'bold 46px Arial'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffd700'
  ctx.shadowColor = '#c8a000'
  ctx.shadowBlur = 8
  ctx.fillText('FLAPPY BIRD', W / 2, H / 2 - 68)

  ctx.shadowBlur = 0
  ctx.font = 'bold 20px Arial'
  ctx.fillStyle = '#fff'
  ctx.fillText('Click or press SPACE', W / 2, H / 2 - 18)
  ctx.fillText('to start!', W / 2, H / 2 + 14)

  ctx.font = '16px Arial'
  ctx.fillStyle = '#d0f0ff'
  ctx.fillText('Avoid the pipes', W / 2, H / 2 + 50)
  ctx.fillText('Score by passing through gaps', W / 2, H / 2 + 72)
  ctx.restore()
}

function drawDeadScreen(ctx: CanvasRenderingContext2D, score: number, best: number) {
  // Overlay
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  // Panel
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, W / 2 - 160, H / 2 - 150, 320, 280, 18)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 2
  roundRect(ctx, W / 2 - 160, H / 2 - 150, 320, 280, 18)
  ctx.stroke()

  ctx.textAlign = 'center'

  // Game Over text
  ctx.font = 'bold 50px Arial'
  ctx.fillStyle = '#ff4444'
  ctx.shadowColor = '#aa0000'
  ctx.shadowBlur = 10
  ctx.fillText('GAME OVER', W / 2, H / 2 - 88)

  ctx.shadowBlur = 0

  // Score
  ctx.font = 'bold 24px Arial'
  ctx.fillStyle = '#fff'
  ctx.fillText('Score', W / 2 - 70, H / 2 - 30)
  ctx.fillText('Best', W / 2 + 70, H / 2 - 30)

  ctx.font = 'bold 40px Arial'
  ctx.fillStyle = '#ffd700'
  ctx.fillText(String(score), W / 2 - 70, H / 2 + 18)
  ctx.fillStyle = '#aaffaa'
  ctx.fillText(String(best), W / 2 + 70, H / 2 + 18)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W / 2 - 130, H / 2 + 40)
  ctx.lineTo(W / 2 + 130, H / 2 + 40)
  ctx.stroke()

  // New best badge
  if (score > 0 && score >= best) {
    ctx.font = 'bold 16px Arial'
    ctx.fillStyle = '#ffd700'
    ctx.fillText('🏆 NEW BEST!', W / 2, H / 2 + 68)
  }

  // Restart button
  ctx.fillStyle = '#5ecc5a'
  roundRect(ctx, W / 2 - 90, H / 2 + 86, 180, 50, 12)
  ctx.fill()
  ctx.strokeStyle = '#2a8026'
  ctx.lineWidth = 2
  roundRect(ctx, W / 2 - 90, H / 2 + 86, 180, 50, 12)
  ctx.stroke()

  ctx.font = 'bold 22px Arial'
  ctx.fillStyle = '#fff'
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 4
  ctx.fillText('▶  Play Again', W / 2, H / 2 + 119)

  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameData>(makeGameData())
  const tickRef = useRef(0)

  const jump = useCallback(() => {
    const g = gameRef.current
    if (g.state === 'idle') {
      g.state = 'playing'
      g.bird.vy = JUMP_FORCE
      g.lastPipeTime = performance.now()
      g.lastTime = performance.now()
      return
    }
    if (g.state === 'playing') {
      g.bird.vy = JUMP_FORCE
    }
    if (g.state === 'dead' && g.deathTimer > 40) {
      const best = Math.max(g.bestScore, g.score)
      Object.assign(gameRef.current, makeGameData(best))
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    function frame(now: number) {
      if (!running) return
      const g = gameRef.current
      tickRef.current++

      // ── Update ──
      if (g.state === 'playing') {
        const dt = Math.min((now - g.lastTime) / 16.67, 3)
        g.lastTime = now

        // Bird physics
        g.bird.vy += GRAVITY * dt
        g.bird.y += g.bird.vy * dt

        // Angle: tilt up when jumping, down when falling
        const targetAngle = Math.max(-0.45, Math.min(1.3, g.bird.vy * 0.065))
        g.bird.angle += (targetAngle - g.bird.angle) * 0.18

        // Spawn pipes
        if (now - g.lastPipeTime > PIPE_INTERVAL) {
          g.pipes.push(randomPipe())
          g.lastPipeTime = now
        }

        // Move pipes
        for (const p of g.pipes) {
          p.x -= PIPE_SPEED * dt
        }

        // Remove off-screen pipes
        g.pipes = g.pipes.filter(p => p.x > -PIPE_WIDTH - 20)

        // Score
        for (const p of g.pipes) {
          if (!p.scored && p.x + PIPE_WIDTH < g.bird.x) {
            p.scored = true
            g.score++
          }
        }

        // Collision
        if (checkCollision(g.bird, g.pipes)) {
          g.state = 'dead'
          g.bestScore = Math.max(g.bestScore, g.score)
          g.deathTimer = 0
          // Knock bird down
          g.bird.vy = 6
        }
      }

      if (g.state === 'dead') {
        g.deathTimer++
        // Let bird fall to ground
        if (g.bird.y + BIRD_SIZE / 2 < H - GROUND_H) {
          g.bird.vy += GRAVITY * 1.5
          g.bird.y += g.bird.vy
          g.bird.angle = Math.min(g.bird.angle + 0.12, Math.PI / 2)
        }
      }

      // ── Draw ──
      drawBackground(ctx!)

      // Draw pipes
      for (const p of g.pipes) {
        drawPipe(ctx!, p)
      }

      drawGround(ctx!)
      drawBird(ctx!, g.bird, tickRef.current)

      if (g.state === 'playing' || g.state === 'idle') {
        drawScore(ctx!, g.score)
      }

      if (g.state === 'idle') {
        drawIdleScreen(ctx!)
      }

      if (g.state === 'dead' && g.deathTimer > 30) {
        drawDeadScreen(ctx!, g.score, g.bestScore)
      }

      g.frameId = requestAnimationFrame(frame)
    }

    gameRef.current.frameId = requestAnimationFrame(frame)

    return () => {
      running = false
      cancelAnimationFrame(gameRef.current.frameId)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        jump()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [jump])

  const handleClick = useCallback(() => {
    jump()
  }, [jump])

  return (
    <main className="flex items-center justify-center w-screen h-screen bg-gray-900">
      <div
        style={{
          position: 'relative',
          boxShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 0 3px #333',
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={handleClick}
          style={{ display: 'block', cursor: 'pointer', userSelect: 'none' }}
        />
      </div>
    </main>
  )
}
