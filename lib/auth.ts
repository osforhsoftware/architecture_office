import { cookies } from "next/headers"
import { isSplitDeployment } from "./app-urls"
import { isTransientDbError, sql, withDbRetry } from "./db"
import type { AppUser } from "./types"

const COOKIE_NAME = "ao_session"

function sessionCookieOptions() {
  const split = isSplitDeployment()
  const domain = process.env.COOKIE_DOMAIN?.trim()

  return {
    httpOnly: true,
    sameSite: split ? ("none" as const) : ("lax" as const),
    secure: split || process.env.NODE_ENV === "production",
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
