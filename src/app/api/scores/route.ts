import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = await getDb()
    const result = await db.query(
      'SELECT id, player_name, score, created_at FROM scores ORDER BY score DESC LIMIT 50'
    )
    return NextResponse.json({ scores: result.rows })
  } catch (err) {
    console.error('GET /api/scores error:', err)
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { player_name, score } = body
    if (!player_name || typeof score !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const db = await getDb()
    await db.query(
      'INSERT INTO scores (player_name, score) VALUES ($1, $2)',
      [String(player_name).slice(0, 20), Math.floor(score)]
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/scores error:', err)
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 })
  }
}
