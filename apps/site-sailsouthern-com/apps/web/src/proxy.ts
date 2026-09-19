import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Identify admin and internal surfaces
  const isAdminOrInternal =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/internal') ||
    pathname.startsWith('/api/admin-proxy')

  // Explicitly allow public admin login endpoints to route without token validation
  const isAdminLoginPath =
    pathname === '/admin/login' ||
    pathname === '/api/admin/login'

  if (isAdminOrInternal && !isAdminLoginPath) {
    const adminSecret = process.env.ADMIN_SECRET_KEY
    if (!adminSecret) {
      // Fail closed immediately if configuration is missing
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized: Secret key config missing' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const headerToken = request.headers.get('x-admin-token')
    const cookieToken = request.cookies.get('admin-token')?.value

    if (headerToken !== adminSecret && cookieToken !== adminSecret) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Determine site mode — env var takes precedence over the JSON file.
  // Set SITE_MODE=live in .env.staging to keep staging always browsable
  // while production stays locked via data/site-mode.json.
  let mode = process.env.SITE_MODE || 'lockout'
  try {
    if (!process.env.SITE_MODE) {
      const pathsToTry = [
        path.join(process.cwd(), 'data', 'site-mode.json'),
        path.join(process.cwd(), '..', '..', 'data', 'site-mode.json'),
        path.resolve('data/site-mode.json'),
      ]
      let configData = ''
      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          configData = fs.readFileSync(p, 'utf-8')
          break
        }
      }
      if (configData) {
        const parsed = JSON.parse(configData)
        if (parsed && parsed.mode) {
          mode = parsed.mode
        }
      }
    }
  } catch (e) {
    console.error('Failed to read site mode, defaulting to lockout:', e)
  }

  // Narrow allowed paths (Public Approved & Framework/System)
  const isPublicAllowed =
    pathname === '/' ||
    pathname === '/api/subscribe' ||
    pathname === '/admin/login' ||
    pathname === '/api/admin/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')

  // Under lockout mode, only allow narrow public allowed routes. Redirect others to Loading page.
  if (mode === 'lockout' && !isPublicAllowed && !isAdminOrInternal) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}
