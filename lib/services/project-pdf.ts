import "server-only"

import { jsPDF } from "jspdf"
import { formatClientId } from "@/lib/constants"
import { formatInvoiceDate } from "@/lib/invoice-utils"
import type { Client, OfficeProfile, Project } from "@/lib/types"

const ACCENT: [number, number, number] = [25, 181, 216] // #19B5D8
const INK: [number, number, number] = [17, 17, 17]
const MUTED: [number, number, number] = [90, 90, 90]
const RULE: [number, number, number] = [40, 40, 40]
const MARGIN = 16

/** ASCII-safe text for jsPDF built-in fonts (no Unicode symbols). */
function pdfText(value: string | null | undefined): string {
  if (!value) return ""
  return String(value)
    .replace(/\u00b7/g, "|")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u20b9/g, "Rs.")
    .replace(/[^\x00-\x7F]/g, "")
}

function drawHRule(doc: jsPDF, y: number, pageWidth: number) {
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
}

function companyDetailLines(profile: OfficeProfile): string[] {
  const lines: string[] = []
  const address = pdfText(profile.address)
  if (address) {
    for (const part of address.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
      lines.push(part)
    }
  }

  const phone = pdfText(profile.phone)
  if (phone) lines.push(phone.toLowerCase().startsWith("mob") ? phone : `Mob: ${phone}`)

  const email = pdfText(profile.email)
  if (email) lines.push(email)

  const website = pdfText(profile.website)
  if (website) lines.push(website)

  if (profile.gstNumber) lines.push(`GSTIN: ${pdfText(profile.gstNumber)}`)
  return lines
}

function parseAadhaar(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "")
        : []
    } catch {
      return []
    }
  }
  return []
}

function packageLabel(value: string | null | undefined): string {
  if (!value) return "—"
  if (value === "full") return "Full Package"
  if (value === "custom") return "Custom Services"
  return pdfText(value)
}

/** Fit logo inside max box without stretching (avoids black wide bars). */
function fitLogoSize(
  doc: jsPDF,
  dataUrl: string,
  maxW: number,
  maxH: number,
): { w: number; h: number; format: "PNG" | "JPEG" } {
  const format: "PNG" | "JPEG" = dataUrl.includes("image/png") ? "PNG" : "JPEG"
  try {
    const props = doc.getImageProperties(dataUrl)
    const ratio = props.width / Math.max(props.height, 1)
    let w = maxW
    let h = w / ratio
    if (h > maxH) {
      h = maxH
      w = h * ratio
    }
    return { w, h, format }
  } catch {
    return { w: maxW, h: maxH, format }
  }
}

function addHeader(doc: jsPDF, profile: OfficeProfile, project: Project, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  /** Branding sits left of project meta; leave room for the right column. */
  const brandMaxX = pageWidth / 2 - 2
  const LOGO_MAX_W = 18
  const LOGO_MAX_H = 16
  const LOGO_GAP = 2.5

  let logoW = 0
  let logoH = 0
  let hasLogo = false

  if (profile.logoDataUrl) {
    try {
      const sized = fitLogoSize(doc, profile.logoDataUrl, LOGO_MAX_W, LOGO_MAX_H)
      logoW = sized.w
      logoH = sized.h
      doc.addImage(profile.logoDataUrl, sized.format, MARGIN, startY, logoW, logoH)
      hasLogo = true
    } catch {
      // skip invalid logo
    }
  }

  // Compact row: [small logo] [company name + contact] — same as invoice print
  const detailsX = hasLogo ? MARGIN + logoW + LOGO_GAP : MARGIN
  const detailsMaxW = Math.max(40, brandMaxX - detailsX)

  const companyName = pdfText(profile.companyName).toUpperCase() || "COMPANY"
  const detailLines = companyDetailLines(profile)
  const showTagline = !hasLogo && Boolean(profile.tagline)

  const logoBottom = hasLogo ? startY + logoH : startY
  // Keep company name near the top of the compact logo; contact lines stay beside/below it.
  let detailsY = hasLogo ? startY + Math.min(4.2, logoH * 0.38 + 2) : startY + 4

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text(companyName, detailsX, detailsY, { maxWidth: detailsMaxW })
  detailsY += 4.8

  if (showTagline) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(pdfText(profile.tagline), detailsX, detailsY, { maxWidth: detailsMaxW })
    detailsY += 4
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  for (const line of detailLines) {
    const wrapped = doc.splitTextToSize(line, detailsMaxW)
    doc.text(wrapped, detailsX, detailsY)
    detailsY += wrapped.length * 3.7
  }

  const brandBottom = Math.max(logoBottom, detailsY)

  const metaX = pageWidth - MARGIN
  const metaLabelX = metaX - 62
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(...INK)
  doc.text("PROJECT SHEET", metaX, startY + 8, { align: "right" })

  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.7)
  doc.line(metaX - 48, startY + 11, metaX, startY + 11)

  const metaRows: [string, string][] = [
    ["PROJECT ID", pdfText(project.code)],
    ["START DATE", formatInvoiceDate(project.created_at)],
  ]
  if (project.invoice_number) {
    metaRows.push(["INVOICE NO", pdfText(project.invoice_number)])
  }

  metaRows.forEach(([label, value], i) => {
    const y = startY + 17 + i * 5
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(...INK)
    doc.text(label, metaLabelX, y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...MUTED)
    doc.text(value, metaX, y, { align: "right" })
  })

  const headerBottom = Math.max(
    brandBottom + 4,
    startY + 17 + metaRows.length * 5 + 4,
  )
  drawHRule(doc, headerBottom, pageWidth)
  return headerBottom + 8
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(title, MARGIN, y)
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y + 2, MARGIN + 28, y + 2)
  return y + 8
}

function addFieldRows(
  doc: jsPDF,
  rows: [string, string][],
  startY: number,
  pageWidth: number,
): number {
  const labelX = MARGIN
  const valueX = MARGIN + 48
  const valueMaxW = pageWidth - MARGIN - valueX
  let y = startY

  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    doc.text(label, labelX, y)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    const lines = doc.splitTextToSize(value || "—", valueMaxW) as string[]
    doc.text(lines, valueX, y)
    y += Math.max(6.5, lines.length * 4.5 + 2)
  })

  return y
}

export function getProjectPdfFileName(projectCode: string): string {
  const safe = projectCode.replace(/[^a-zA-Z0-9-_]/g, "_")
  return `Project_${safe}.pdf`
}

/**
 * Printable project document with client + project details only.
 * Excludes staff assignment, workflow, payments, and other operational data.
 */
export function buildProjectPdfBuffer(
  project: Project,
  client: Client | null,
  profile: OfficeProfile,
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let y = addHeader(doc, profile, project, 14)

  y = addSectionTitle(doc, "CLIENT INFORMATION", y)

  const aadhaar = parseAadhaar(client?.aadhaar_numbers)
  const linked = parseAadhaar(client?.linked_numbers)
  const addressParts = [
    client?.address,
    client?.street,
    client?.district,
  ].filter(Boolean) as string[]

  const clientRows: [string, string][] = [
    ["CLIENT ID", client ? formatClientId(client.id) : "—"],
    ["NAME", pdfText(client?.name || project.client_name)],
    ["PHONE", pdfText(client?.phone || project.client_phone)],
    ["EMAIL", pdfText(client?.email) || "—"],
    ["ADDRESS", pdfText(addressParts.join(", ")) || "—"],
  ]
  if (aadhaar.length) {
    clientRows.push(["AADHAAR", pdfText(aadhaar.join(", "))])
  }
  if (linked.length) {
    clientRows.push(["LINKED NO.", pdfText(linked.join(", "))])
  }

  y = addFieldRows(doc, clientRows, y, pageWidth)
  y += 4
  drawHRule(doc, y, pageWidth)
  y += 8

  y = addSectionTitle(doc, "PROJECT INFORMATION", y)

  const projectRows: [string, string][] = [
    ["PROJECT ID", pdfText(project.code)],
    ["PROJECT NAME", pdfText(project.name)],
    ["TYPE", pdfText(project.type) || "General"],
    ["LOCATION", pdfText(project.location) || "—"],
    ["PACKAGE", packageLabel(project.project_package)],
    ["PRIORITY", pdfText(project.priority) || "—"],
    ["DUE DATE", formatInvoiceDate(project.due_date)],
  ]

  if (project.drawing_number) {
    projectRows.push(["DRAWING NO.", pdfText(project.drawing_number)])
  }
  projectRows.push(["MBOOK NO.", pdfText(project.edgebook_number) || "—"])
  if (project.refer_name) {
    projectRows.push(["REFER NAME", pdfText(project.refer_name)])
  }
  if (project.notes) {
    projectRows.push(["NOTES", pdfText(project.notes)])
  }
  if (project.building_number) {
    projectRows.push(["BUILDING NO.", pdfText(project.building_number)])
  }
  if (project.building_permit_number) {
    projectRows.push(["PERMIT NO.", pdfText(project.building_permit_number)])
  }

  const reqs: string[] = []
  if (project.req_architectural_plan) reqs.push("Architectural Plan")
  if (project.req_building_permit) reqs.push("Building Permit")
  if (project.req_regularization) reqs.push("Regularization")
  if (reqs.length) {
    projectRows.push(["REQUIREMENTS", pdfText(reqs.join(", "))])
  }

  y = addFieldRows(doc, projectRows, y, pageWidth)
  y += 6
  drawHRule(doc, y, pageWidth)

  // Footer
  const footerY = pageHeight - 12
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(
    pdfText(profile.companyName) || "Architecture Office",
    MARGIN,
    footerY,
  )
  doc.text("Client & project record", pageWidth - MARGIN, footerY, { align: "right" })

  const arrayBuffer = doc.output("arraybuffer")
  return Buffer.from(arrayBuffer)
}
