import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = await getDb()
    const result = await db.query<{
      id: number
      player_name: string
      score: number
      created_at: string
    }>(
      'SELECT id, player_name, score, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT 20'
    )
    return NextResponse.json({ scores: result.rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[GET /api/scores] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const player_name = typeof body.player_name === 'string' ? body.player_name.trim() : ''
    const score = typeof body.score === 'number' ? Math.floor(body.score) : null

    if (!player_name) {
      return NextResponse.json({ error: 'player_name is required' }, { status: 400 })
    }
    if (score === null || score < 0) {
      return NextResponse.json({ error: 'score must be a non-negative number' }, { status: 400 })
    }

    const db = await getDb()
    const result = await db.query<{ id: number }>(
      'INSERT INTO scores (player_name, score) VALUES ($1, $2) RETURNING id',
      [player_name, score]
    )

    const insertedId = result.rows[0]?.id
    return NextResponse.json({ success: true, id: insertedId }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[POST /api/scores] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
