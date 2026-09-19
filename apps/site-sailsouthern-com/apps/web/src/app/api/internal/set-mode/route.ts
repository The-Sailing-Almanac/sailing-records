import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  // Direct secret key check inside route handler
  const adminSecret = process.env.ADMIN_SECRET_KEY
  if (!adminSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Secret key config missing' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const headerToken = request.headers.get('x-admin-token')
  const cookieToken = request.cookies.get('admin-token')?.value

  if (headerToken !== adminSecret && cookieToken !== adminSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await request.json()
    const { mode } = body

    if (!mode || !['live', 'lockout', 'rollback_24h', 'kill_latest_issue'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode specified' }, { status: 400 })
    }

    const configPath = path.join(process.cwd(), '..', '..', 'data', 'site-mode.json')
    const alternativePath = path.join(process.cwd(), 'data', 'site-mode.json')
    const activePath = fs.existsSync(path.join(process.cwd(), '..', '..', 'data')) ? configPath : alternativePath

    const config = {
      mode,
      last_updated: new Date().toISOString()
    }

    fs.writeFileSync(activePath, JSON.stringify(config, null, 2))

    return NextResponse.json({ success: true, mode, last_updated: config.last_updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
