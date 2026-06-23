import { NextResponse } from "next/server"
import { getFrontendUrl, isSplitDeployment } from "@/lib/app-urls"

function corsHeaders(): Record<string, string> {
  if (!isSplitDeployment()) return {}

  const frontend = getFrontendUrl()
  if (!frontend) return {}

  return {
    "Access-Control-Allow-Origin": frontend,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

export function withApiCors<T extends Response>(response: T): T {
  for (const [key, value] of Object.entries(corsHeaders())) {
    response.headers.set(key, value)
  }
  return response
}

export function apiOptionsResponse(): NextResponse {
  return withApiCors(new NextResponse(null, { status: 204 }))
}
