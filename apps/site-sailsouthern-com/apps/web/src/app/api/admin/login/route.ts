import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    const adminSecret = process.env.ADMIN_SECRET_KEY

    if (!adminSecret) {
      return NextResponse.json({ error: 'System configuration error: key missing' }, { status: 500 })
    }

    if (token !== adminSecret) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })
    
    // Set secure cookie
    response.cookies.set('admin-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/'
    })

    return response
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
