import { NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

async function handleProxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  // Direct secret key check inside route handler
  const adminSecret = process.env.ADMIN_SECRET_KEY
  if (!adminSecret) {
    return NextResponse.json({ error: 'Unauthorized: Secret key config missing' }, { status: 403 });
  }

  const headerToken = request.headers.get('x-admin-token');
  
  // Extract cookie
  let cookieToken: string | undefined;
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;)\s*admin-token\s*=\s*([^;]+)/);
  if (match) {
    cookieToken = decodeURIComponent(match[1]);
  }

  if (headerToken !== adminSecret && cookieToken !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { path } = await params;
    const pathStr = path.join('/');
    
    // Get search parameters
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    
    const targetUrl = `${API_BASE}/api/${pathStr}${queryString ? `?${queryString}` : ''}`;
    
    const adminKey = process.env.ADMIN_API_KEY || "";
    
    const headers: Record<string, string> = {
      'x-admin-api-key': adminKey,
    };
    
    let body: any = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        body = await request.text();
        headers['Content-Type'] = request.headers.get('Content-Type') || 'application/json';
      } catch {
        // No body
      }
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body,
      cache: 'no-store',
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        data || { error: 'Failed to execute admin action' },
        { status: response.status }
      );
    }

    return NextResponse.json(data || { success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Admin proxy error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export {
  handleProxy as GET,
  handleProxy as POST,
  handleProxy as PATCH,
  handleProxy as PUT,
  handleProxy as DELETE,
};
