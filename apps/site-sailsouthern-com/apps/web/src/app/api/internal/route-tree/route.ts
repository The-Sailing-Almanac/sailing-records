import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

export interface RouteNode {
  id: string
  path: string
  type: string
  status: 'allowed' | 'blocked' | 'system' | 'staged'
  depth: number
  parent: string | null
  children: string[]
  created: string
  modified: string
}

const BASE_ROUTES: RouteNode[] = [
  {
    id: "route-homepage",
    path: "/",
    type: "homepage",
    status: "allowed",
    depth: 0,
    parent: null,
    children: [
      "route-about", "route-admin", "route-blog", "route-boats", "route-builder",
      "route-daily", "route-entities", "route-handicap-estimate", "route-handicap-intel",
      "route-handicap-phrf", "route-submit", "route-support", "route-supporters",
      "route-weekly-edition"
    ],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-about",
    path: "/about",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-admin",
    path: "/admin",
    type: "admin",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: ["route-admin-routes"],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-admin-routes",
    path: "/admin/routes",
    type: "admin",
    status: "blocked",
    depth: 2,
    parent: "route-admin",
    children: [],
    created: "2026-05-30T10:00:00Z",
    modified: "2026-05-30T10:00:00Z"
  },
  {
    id: "route-blog",
    path: "/blog",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: ["route-blog-slug"],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-blog-slug",
    path: "/blog/[slug]",
    type: "dynamic",
    status: "blocked",
    depth: 2,
    parent: "route-blog",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-boats",
    path: "/boats",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: ["route-boats-id"],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-boats-id",
    path: "/boats/[id]",
    type: "dynamic",
    status: "blocked",
    depth: 2,
    parent: "route-boats",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-builder",
    path: "/builder",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-daily",
    path: "/daily",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: ["route-daily-latest", "route-daily-date"],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-daily-latest",
    path: "/daily/latest",
    type: "page",
    status: "blocked",
    depth: 2,
    parent: "route-daily",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-daily-date",
    path: "/daily/[date]",
    type: "dynamic",
    status: "blocked",
    depth: 2,
    parent: "route-daily",
    children: ["route-daily-date-section"],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-daily-date-section",
    path: "/daily/[date]/[section]",
    type: "dynamic",
    status: "blocked",
    depth: 3,
    parent: "route-daily-date",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-entities",
    path: "/entities",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: ["route-entities-slug"],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-entities-slug",
    path: "/entities/[slug]",
    type: "dynamic",
    status: "blocked",
    depth: 2,
    parent: "route-entities",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-handicap-estimate",
    path: "/handicap/estimate",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-handicap-intel",
    path: "/handicap/fleet-intel",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-handicap-phrf",
    path: "/handicap/phrf",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-submit",
    path: "/submit",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-support",
    path: "/support",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-supporters",
    path: "/supporters",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-weekly-edition",
    path: "/weekly-edition",
    type: "page",
    status: "blocked",
    depth: 1,
    parent: "route-homepage",
    children: ["route-weekly-edition-date"],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-weekly-edition-date",
    path: "/weekly-edition/[date]",
    type: "dynamic",
    status: "blocked",
    depth: 2,
    parent: "route-weekly-edition",
    children: ["route-weekly-edition-date-section"],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "route-weekly-edition-date-section",
    path: "/weekly-edition/[date]/[section]",
    type: "dynamic",
    status: "blocked",
    depth: 3,
    parent: "route-weekly-edition-date",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "system-api",
    path: "/api",
    type: "system",
    status: "system",
    depth: 1,
    parent: "route-homepage",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  },
  {
    id: "system-next",
    path: "/_next",
    type: "system",
    status: "system",
    depth: 1,
    parent: "route-homepage",
    children: [],
    created: "2026-05-28T05:00:00Z",
    modified: "2026-05-30T05:00:00Z"
  }
]

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')

  // Read current site mode
  let mode = 'lockout'
  try {
    const configPath = path.join(process.cwd(), '..', '..', 'data', 'site-mode.json')
    const alternativePath = path.join(process.cwd(), 'data', 'site-mode.json')
    const activePath = fs.existsSync(configPath) ? configPath : alternativePath
    if (fs.existsSync(activePath)) {
      const data = JSON.parse(fs.readFileSync(activePath, 'utf-8'))
      if (data && data.mode) {
        mode = data.mode
      }
    }
  } catch (e) {
    console.error(e)
  }

  // Map route statuses based on mode
  const routes = BASE_ROUTES.map(route => {
    let status = route.status
    if (route.type === 'homepage' || route.type === 'system') {
      status = 'system'
    } else {
      if (mode === 'live') {
        status = 'allowed'
      } else if (mode === 'lockout') {
        status = 'blocked'
      } else if (mode === 'rollback_24h') {
        status = 'staged'
      } else if (mode === 'kill_latest_issue') {
        status = 'blocked'
      }
    }
    return { ...route, status }
  })

  const total = routes.length
  const allowed = routes.filter(r => r.status === 'allowed' || r.status === 'system' || r.path === '/').length
  const blocked = total - allowed

  const payload = {
    metadata: {
      site: "sailsouthern.com",
      mode: mode,
      last_updated: new Date().toISOString(),
      total_routes: total,
      allowed: allowed,
      blocked: blocked
    },
    routes
  }

  if (format === 'opml') {
    let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Sail Southern Route Tree</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
`
    const buildOutline = (node: typeof routes[0]): string => {
      const children = routes.filter(r => r.parent === node.id)
      const childXml = children.map(c => buildOutline(c)).join('\n')
      
      if (children.length > 0) {
        return `    <outline text="${node.path}" id="${node.id}" type="${node.type}" status="${node.status}">\n${childXml.split('\n').map(l => '  ' + l).join('\n')}\n    </outline>`
      } else {
        return `    <outline text="${node.path}" id="${node.id}" type="${node.type}" status="${node.status}" />`
      }
    }

    const root = routes.find(r => r.parent === null)
    if (root) {
      opml += buildOutline(root)
    }
    opml += `
  </body>
</opml>`

    return new Response(opml, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': 'attachment; filename="route_tree.opml"'
      }
    })
  }

  return NextResponse.json(payload)
}
