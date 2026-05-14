import { NextRequest, NextResponse } from 'next/server'

// PGLite runs client-side only — this API route is a no-op placeholder
// All DB operations happen in the browser via the client component
export async function GET(_req: NextRequest) {
  return NextResponse.json({ message: 'Scores are managed client-side via PGLite' })
}
