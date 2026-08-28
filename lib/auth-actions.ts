"use server"

import { headers } from "next/headers"
import { isTransientDbError, sql, withDbRetry } from "./db"
import { setSession } from "./auth"
import { homePathForRole } from "./constants"
import { verifyPassword } from "./password"
import { logAuditForUser } from "./project-access"
import type { AppUser } from "./types"

export type LoginState = {
  error?: string
  redirectTo?: string
} | null

function safeNextPath(raw: unknown): string | null {
  const path = String(raw || "").trim()
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/login")) {
    return null
  }
  if (path === "/" || path.includes("://") || path.includes("\\")) return null
  return path
}

async function clientIpAddress(): Promise<string | null> {
  try {
    const h = await headers()
    const forwarded = h.get("x-forwarded-for")
    if (forwarded) return forwarded.split(",")[0]?.trim() || null
    return h.get("x-real-ip")
  } catch {
    return null
  }
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<NonNullable<LoginState>> {
  const loginId = String(formData.get("username") || "").trim()
  const password = String(formData.get("password") || "")

  if (!loginId || !password) {
    return { error: "Please enter your email or username and password." }
  }

  try {
    const rows = (await withDbRetry(
      () => sql`
        SELECT id, username, password, role, name, active FROM app_users
        WHERE username = ${loginId}
           OR (email IS NOT NULL AND LOWER(email) = LOWER(${loginId}))
        LIMIT 1
      `,
    )) as (AppUser & { password: string; active: boolean })[]

    const user = rows[0]
    if (!user || !(await verifyPassword(password, user.password))) {
      return { error: "Invalid email/username or password." }
    }

    if (user.active === false) {
      return { error: "This account has been deactivated. Contact your administrator." }
    }

    await setSession(user.id)
    const ip = await clientIpAddress()
    await logAuditForUser(user, "auth.login", "user", user.id, { username: user.username }, ip)

    // Return a path instead of redirect() so Next.js does not fetch the heavy
    // dashboard inside this POST (that was surfacing as "Failed to fetch").
    return { redirectTo: safeNextPath(formData.get("next")) ?? homePathForRole(user.role) }
  } catch (error) {
    if (isTransientDbError(error)) {
      return { error: "Database is unavailable. Please try again." }
    }
    console.error("[login]", error)
    return { error: "Sign in failed. Please try again." }
  }
}
