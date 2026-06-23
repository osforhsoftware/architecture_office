/**
 * Frontend/backend URL helpers for single-server and split deployments.
 *
 * Set in .env:
 *   FRONTEND_URL=https://demo.yourdomain.com
 *   BACKEND_URL=https://api.yourdomain.com
 *
 * When BACKEND_URL is empty, API paths stay relative (same server).
 */

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

function normalizeAbsoluteUrl(value: string): string | undefined {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  const normalized = trimTrailingSlash(withProtocol)

  try {
    return new URL(normalized).toString().replace(/\/$/, "")
  } catch {
    return undefined
  }
}

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const rawValue = process.env[key]?.trim()
    if (!rawValue) continue

    const normalizedValue = normalizeAbsoluteUrl(rawValue)
    if (normalizedValue) return normalizedValue
  }
  return undefined
}

/** Public website URL users open in the browser. */
export function getFrontendUrl(): string | undefined {
  return readEnv(
    "NEXT_PUBLIC_FRONTEND_URL",
    "FRONTEND_URL",
    "NEXT_PUBLIC_APP_URL",
    "APP_URL",
  )
}

/** API server URL when frontend and backend run on different hosts. */
export function getBackendUrl(): string | undefined {
  return readEnv(
    "NEXT_PUBLIC_BACKEND_URL",
    "BACKEND_URL",
    "NEXT_PUBLIC_API_URL",
    "API_URL",
  )
}

/** True when frontend and backend URLs are both set and different. */
export function isSplitDeployment(): boolean {
  const frontend = getFrontendUrl()
  const backend = getBackendUrl()
  return Boolean(frontend && backend && frontend !== backend)
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`
}

/** Build an API path, prefixing BACKEND_URL when configured. */
export function apiUrl(path: string): string {
  const normalized = normalizePath(path)
  const backend = getBackendUrl()
  return backend ? `${backend}${normalized}` : normalized
}

/** Build a frontend path, prefixing FRONTEND_URL when configured. */
export function frontendUrl(path: string = ""): string {
  if (!path) return getFrontendUrl() ?? "/"
  const normalized = normalizePath(path)
  const frontend = getFrontendUrl()
  return frontend ? `${frontend}${normalized}` : normalized
}

/** Resolve static/upload paths for split deployments. */
export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }
  return apiUrl(path)
}

/** Fetch wrapper that sends cookies when calling a separate backend host. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    credentials: isSplitDeployment() ? "include" : (init?.credentials ?? "same-origin"),
  })
}
