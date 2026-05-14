import { PGlite } from '@electric-sql/pglite'
import path from 'path'
import fs from 'fs'

let db: PGlite | null = null

export async function getDb(): Promise<PGlite> {
  if (db) return db

  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  db = new PGlite(path.join(dataDir, 'flappy.db'))

  await db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      player_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `)

  return db
}
