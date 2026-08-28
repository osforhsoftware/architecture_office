import "server-only"

import type { jsPDF } from "jspdf"

const PT_TO_MM = 25.4 / 72
/** Helvetica cap-height / em — used so the logo matches visible lettering, not the em box. */
const CAP = 0.718
const DESC = 0.207

const LOGO_MAX_W = 22
const LOGO_GAP = 0.8
const NAME_SIZE = 12
const BODY_SIZE = 8

export function formatPdfCompanyName(value: string): string {
  const named = value
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return named || "Company"
}

function fitLogoToHeight(
  doc: jsPDF,
  dataUrl: string,
  targetH: number,
  maxW: number,
): { w: number; h: number; format: "PNG" | "JPEG" } {
  const format: "PNG" | "JPEG" = dataUrl.includes("image/png") ? "PNG" : "JPEG"
  const h = Math.max(targetH, 1)
  try {
    const props = doc.getImageProperties(dataUrl)
    const ratio = props.width / Math.max(props.height, 1)
    let w = h * ratio
    if (w > maxW) {
      w = maxW
      return { w, h: w / ratio, format }
    }
    return { w, h, format }
  } catch {
    return { w: Math.min(maxW, h), h, format }
  }
}

export function drawPdfBrandLockup(
  doc: jsPDF,
  opts: {
    startY: number
    margin: number
    brandMaxX: number
    companyName: string
    detailLines: string[]
    tagline?: string | null
    logoDataUrl: string | null
    ink: [number, number, number]
    muted: [number, number, number]
  },
): number {
  const {
    startY,
    margin,
    brandMaxX,
    companyName,
    detailLines,
    logoDataUrl,
    ink,
    muted,
  } = opts
  const showTagline = !logoDataUrl && Boolean(opts.tagline)

  const nameCap = NAME_SIZE * PT_TO_MM * CAP
  const nameDesc = NAME_SIZE * PT_TO_MM * DESC
  const bodyCap = BODY_SIZE * PT_TO_MM * CAP
  const bodyDesc = BODY_SIZE * PT_TO_MM * DESC
  const afterName = nameDesc + 0.45 + bodyCap
  const bodyStep = BODY_SIZE * PT_TO_MM * 1.28

  doc.setFont("helvetica", "normal")
  doc.setFontSize(BODY_SIZE)

  const wrapBody = (maxW: number): string[] => {
    const lines: string[] = []
    if (showTagline && opts.tagline) lines.push(opts.tagline)
    for (const line of detailLines) {
      lines.push(...(doc.splitTextToSize(line, maxW) as string[]))
    }
    return lines
  }

  const blockHeight = (bodyCount: number) => {
    const nameBottom = nameCap + nameDesc
    if (bodyCount <= 0) return nameBottom
    return nameCap + afterName + (bodyCount - 1) * bodyStep + bodyDesc
  }

  let detailsX = margin
  let detailsMaxW = Math.max(40, brandMaxX - detailsX)
  let body = wrapBody(detailsMaxW)
  let blockH = blockHeight(body.length)
  let logoBottom = startY

  if (logoDataUrl) {
    try {
      detailsMaxW = Math.max(40, brandMaxX - margin - LOGO_MAX_W - LOGO_GAP)
      body = wrapBody(detailsMaxW)
      blockH = blockHeight(body.length)
      let sized = fitLogoToHeight(doc, logoDataUrl, blockH, LOGO_MAX_W)
      detailsX = margin + sized.w + LOGO_GAP
      detailsMaxW = Math.max(40, brandMaxX - detailsX)
      body = wrapBody(detailsMaxW)
      blockH = blockHeight(body.length)
      sized = fitLogoToHeight(doc, logoDataUrl, blockH, LOGO_MAX_W)
      detailsX = margin + sized.w + LOGO_GAP
      detailsMaxW = Math.max(40, brandMaxX - detailsX)
      body = wrapBody(detailsMaxW)
      blockH = blockHeight(body.length)

      const logoY = startY + Math.max(0, (blockH - sized.h) / 2)
      doc.addImage(logoDataUrl, sized.format, margin, logoY, sized.w, sized.h)
      logoBottom = logoY + sized.h
    } catch {
      detailsX = margin
      detailsMaxW = Math.max(40, brandMaxX - detailsX)
      body = wrapBody(detailsMaxW)
      blockH = blockHeight(body.length)
    }
  }

  const nameBaseline = startY + nameCap
  doc.setFont("helvetica", "bold")
  doc.setFontSize(NAME_SIZE)
  doc.setTextColor(...ink)
  doc.text(companyName, detailsX, nameBaseline, { maxWidth: detailsMaxW })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(BODY_SIZE)
  doc.setTextColor(...muted)
  body.forEach((line, i) => {
    const y = nameBaseline + afterName + i * bodyStep
    doc.text(line, detailsX, y)
  })

  return Math.max(logoBottom, startY + blockH)
}
