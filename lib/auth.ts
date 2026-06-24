import { cookies } from "next/headers"
import { getFrontendUrl, isSplitDeployment } from "./app-urls"
import { isTransientDbError, sql, withDbRetry } from "./db"
import type { AppUser } from "./types"

const COOKIE_NAME = "ao_session"

/**
 * Secure cookies are required for HTTPS and cross-site (split) deployments.
 * Do not tie this to NODE_ENV alone — HTTP VPS / IP demos must allow non-secure cookies.
 */
function isCookieSecure(): boolean {
  const explicit = process.env.COOKIE_SECURE?.trim().toLowerCase()
  if (explicit === "true") return true
  if (explicit === "false") return false

  const frontend = getFrontendUrl()
  if (frontend) {
    return frontend.startsWith("https://")
  }

  return isSplitDeployment()
}

function sessionCookieOptions() {
  const split = isSplitDeployment()
  const domain = process.env.COOKIE_DOMAIN?.trim()
  const secure = isCookieSecure()

  return {
    httpOnly: true,
    sameSite: split ? ("none" as const) : ("lax" as const),
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    ...(domain ? { domain } : {}),
  }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return null
  const userId = Number.parseInt(raw, 10)
  if (!Number.isFinite(userId)) return null

  try {
    const rows = (await withDbRetry(
      () => sql`
        SELECT id, username, role, name FROM app_users WHERE id = ${userId} LIMIT 1
      `,
    )) as AppUser[]
    return rows[0] ?? null
  } catch (error) {
    if (isTransientDbError(error)) {
      console.error("[auth] Database unavailable:", error)
      return null
    }
    throw error
  }
}

export async function setSession(userId: number) {
  const store = await cookies()
  store.set(COOKIE_NAME, String(userId), sessionCookieOptions())
}

export async function clearSession() {
  const store = await cookies()
  store.delete({ name: COOKIE_NAME, ...sessionCookieOptions() })
}
