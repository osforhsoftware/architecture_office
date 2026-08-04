import "server-only"

import { readFile } from "fs/promises"
import path from "path"
import { getBackendUrl } from "@/lib/app-urls"
import type { OfficeProfile } from "@/lib/types"

async function readLogoBuffer(logo: string): Promise<Buffer | null> {
  if (logo.startsWith("/")) {
    try {
      const filePath = path.join(process.cwd(), "public", logo.replace(/^\//, ""))
      return await readFile(filePath)
    } catch {
      // fall through to remote fetch when split deployment serves assets from backend URL
    }
  }

  const backend = getBackendUrl()
  if (logo.startsWith("/") && backend) {
    try {
      const res = await fetch(`${backend}${logo}`)
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    } catch {
      return null
    }
  }

  return null
}

/** Resolve stored logo (path or data URL) to a data URL for PDF embedding. */
export async function resolveLogoDataUrl(
  logo: string | null | undefined,
): Promise<string | null> {
  if (!logo) return null
  if (logo.startsWith("data:")) return logo

  if (logo.startsWith("/")) {
    const buf = await readLogoBuffer(logo)
    if (!buf) return null
    const mime = logo.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"
    return `data:${mime};base64,${buf.toString("base64")}`
  }

  return logo
}

export async function resolveOfficeLogoForPdf(
  profile: OfficeProfile,
): Promise<OfficeProfile> {
  const [logoDataUrl, qrCodeDataUrl, signatureDataUrl] = await Promise.all([
    resolveLogoDataUrl(profile.logoDataUrl),
    resolveLogoDataUrl(profile.qrCodeDataUrl),
    resolveLogoDataUrl(profile.signatureDataUrl),
  ])
  return { ...profile, logoDataUrl, qrCodeDataUrl, signatureDataUrl }
}
