import { PGlite } from '@electric-sql/pglite'
import path from 'path'
import fs from 'fs'

let dbInstance: PGlite | null = null
let initPromise: Promise<PGlite> | null = null

async function initDb(): Promise<PGlite> {
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const db = new PGlite(path.join(dataDir, 'app.db'))

  await db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      player_name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `)

  return db
}

export async function getDb(): Promise<PGlite> {
  if (dbInstance) return dbInstance
  if (initPromise) return initPromise

  initPromise = initDb().then(db => {
    dbInstance = db
    initPromise = null
    return db
  }).catch(err => {
    initPromise = null
    throw err
  })

  return initPromise
}
