import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const COOKIE_NAME = "ao_session"

const PUBLIC_PATHS = ["/login"]

/**
 * Prefer the public URL (IP/domain via nginx) over the internal listen address.
 * Without this, redirects behind a reverse proxy become http://localhost:3001/...
 */
function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = forwardedHost || request.headers.get("host")?.trim()
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    request.nextUrl.protocol.replace(":", "") ||
    "http"

  if (host && !/^localhost(?::\d+)?$/i.test(host) && !/^127\.\d+\.\d+\.\d+(?::\d+)?$/.test(host)) {
    return `${proto}://${host}`
  }

  const configured =
    process.env.NEXT_PUBLIC_FRONTEND_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      /* ignore invalid env */
    }
  }

  return request.nextUrl.origin
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get(COOKIE_NAME)?.value
  const origin = publicOrigin(request)

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next()
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (session) {
      return NextResponse.redirect(new URL("/", origin))
    }
    return NextResponse.next()
  }

  if (!session) {
    const login = new URL("/login", origin)
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
