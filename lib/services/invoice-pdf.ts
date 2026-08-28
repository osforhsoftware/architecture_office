import "server-only"

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatCurrency } from "@/lib/constants"
import { formatInvoiceDate, sanitizeLineItemInput } from "@/lib/invoice-utils"
import type { InvoiceLineItem, InvoiceWithDetails, OfficeProfile } from "@/lib/types"
import { drawPdfBrandLockup, formatPdfCompanyName } from "@/lib/services/pdf-brand-header"
import { getUpiPaymentApp, UPI_PAYMENT_APPS, upiPaymentNumberLabel } from "@/lib/upi-apps"

/** Professional monochrome palette for print / PDF — dark enough to stay crisp on paper */
const INK: [number, number, number] = [22, 22, 22]
const MUTED: [number, number, number] = [48, 48, 48]
const RULE: [number, number, number] = [170, 170, 170]
const RULE_STRONG: [number, number, number] = [90, 90, 90]
const BORDER: [number, number, number] = [150, 150, 150]
/** ~12 mm — within the 10–15 mm print-safe range for A4 */
const MARGIN = 12

/** ASCII-safe text for jsPDF built-in fonts (no Unicode symbols). */
function pdfText(value: string | null | undefined): string {
  if (!value) return ""
  return String(value)
    .replace(/\u00b7/g, "|")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u20b9/g, "Rs.")
    .replace(/[^\x00-\x7F]/g, "")
}

function formatPdfCurrency(value: number | string): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  const amount = Number.isFinite(n) ? n : 0
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `Rs. ${formatted}`
}

function formatPdfQuantity(value: number | string, unit?: string | null): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return "0.00"
  const qty = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
  const u = pdfText(unit)
  return u && u !== "Nos" ? `${qty} ${u}` : qty
}

function drawHRule(doc: jsPDF, y: number, pageWidth: number, strong = false) {
  doc.setDrawColor(...(strong ? RULE_STRONG : RULE))
  // Heavier strokes so rules stay visible on print / photocopy
  doc.setLineWidth(strong ? 0.55 : 0.4)
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

function addHeader(
  doc: jsPDF,
  profile: OfficeProfile,
  invoice: InvoiceWithDetails,
  startY: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const brandMaxX = pageWidth / 2 - 2
  const brandBottom = drawPdfBrandLockup(doc, {
    startY,
    margin: MARGIN,
    brandMaxX,
    companyName: formatPdfCompanyName(pdfText(profile.companyName)),
    detailLines: companyDetailLines(profile),
    tagline: pdfText(profile.tagline) || null,
    logoDataUrl: profile.logoDataUrl,
    ink: INK,
    muted: MUTED,
  })

  const metaX = pageWidth - MARGIN
  const metaLabelX = metaX - 52
  const titleSize = 18
  const titleBaseline = startY + titleSize * (25.4 / 72) * 0.718
  doc.setFont("helvetica", "bold")
  doc.setFontSize(titleSize)
  doc.setTextColor(...INK)
  doc.text("INVOICE", metaX, titleBaseline, { align: "right" })

  const metaRows: [string, string][] = [
    ["Invoice No", pdfText(invoice.invoice_number)],
    ["Date", formatInvoiceDate(invoice.invoice_date)],
  ]
  if (invoice.due_date) metaRows.push(["Due Date", formatInvoiceDate(invoice.due_date)])
  if (invoice.project_code) metaRows.push(["Project Code", pdfText(invoice.project_code)])

  const metaStart = titleBaseline + 4.4
  metaRows.forEach(([label, value], i) => {
    const rowY = metaStart + i * 4.4
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    doc.text(label, metaLabelX, rowY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...MUTED)
    doc.text(value, metaX, rowY, { align: "right" })
  })

  const metaBottom = metaStart + metaRows.length * 4.4
  const headerBottom = Math.max(brandBottom + 2.5, metaBottom + 1.5)
  drawHRule(doc, headerBottom, pageWidth, true)
  return headerBottom + 6
}

function addClientProjectBlock(
  doc: jsPDF,
  invoice: InvoiceWithDetails,
  startY: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const midX = pageWidth / 2
  let y = startY

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  doc.text("BILL TO", MARGIN, y)
  doc.text("PROJECT DETAILS", midX + 4, y)

  y += 5
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text(pdfText(invoice.client_name), MARGIN, y)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)

  const billLines = [
    pdfText(invoice.client_address),
    invoice.client_tax_id ? `GSTIN: ${pdfText(invoice.client_tax_id)}` : "",
    pdfText(invoice.client_phone),
    pdfText(invoice.client_email),
  ].filter(Boolean) as string[]

  billLines.forEach((line, i) => {
    doc.text(line, MARGIN, y + 5 + i * 4.2, { maxWidth: midX - MARGIN - 6 })
  })

  const projectRows: [string, string][] = []
  if (invoice.project_name) projectRows.push(["Project", pdfText(invoice.project_name)])
  if (invoice.project_location) {
    projectRows.push(["Location", pdfText(invoice.project_location)])
  }
  if (invoice.status) projectRows.push(["Status", pdfText(invoice.status)])

  const projectLabelX = midX + 4
  const projectValueX = midX + 28
  const projectValueMaxW = pageWidth - MARGIN - projectValueX
  const projectRowH = 5.5

  projectRows.forEach(([label, value], i) => {
    const rowY = y + i * projectRowH
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    doc.text(label, projectLabelX, rowY)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    doc.text(value, projectValueX, rowY, { maxWidth: projectValueMaxW })
  })

  const projectBlockH = Math.max(projectRows.length * projectRowH, 0)
  const billBlockH = billLines.length * 4.2 + 5

  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.35)
  doc.line(midX, startY - 1, midX, y + Math.max(billBlockH, projectBlockH) + 1)

  const blockBottom = y + Math.max(billBlockH, projectBlockH) + 3
  drawHRule(doc, blockBottom, pageWidth)
  return blockBottom + 5
}

function sanitizePdfLineItem(item: InvoiceLineItem) {
  return sanitizeLineItemInput({
    description: item.description,
    quantity: Number(item.quantity) || 0,
    unit: item.unit ?? "Nos",
    unit_price: Number(item.unit_price) || 0,
    discount_amount: Number(item.discount_amount) || 0,
    discount_percent: Number(item.discount_percent) || 0,
  })
}

function addSummaryBlock(
  doc: jsPDF,
  invoice: InvoiceWithDetails,
  startY: number,
  pageWidth: number,
): number {
  const boxWidth = 72
  const boxX = pageWidth - MARGIN - boxWidth
  const taxPercent = Number(invoice.tax_percent) || 0
  const storedSubtotal = Number(invoice.subtotal) || 0
  const discount = Number(invoice.discount_amount) || 0
  const tax = Number(invoice.tax_amount) || 0
  const total = Number(invoice.total) || 0
  const paid = Number(invoice.amount_paid) || 0
  // Stored subtotal is taxable (after discount). Reconstruct gross when discount exists.
  const gross = discount > 0 ? storedSubtotal + discount : storedSubtotal

  const rows: { label: string; value: string; emphasize?: boolean }[] = [
    { label: "Subtotal", value: formatPdfCurrency(gross) },
  ]
  if (discount > 0) {
    rows.push({ label: "Discount", value: `-${formatPdfCurrency(discount)}` })
  }
  rows.push(
    { label: `GST (${taxPercent}%)`, value: formatPdfCurrency(tax) },
    { label: "Grand Total", value: formatPdfCurrency(total), emphasize: true },
  )
  if (paid > 0) {
    const balanceDue = Math.max(0, total - paid)
    rows.push(
      { label: "Amount Paid", value: `-${formatPdfCurrency(paid)}` },
      { label: "Balance Due", value: formatPdfCurrency(balanceDue), emphasize: true },
    )
  }

  const rowH = 6.5
  const padX = 3.5
  const padY = 3.5
  // Extra top space before Grand Total / Balance Due so the rule isn't flush to the label
  const emphasizeTop = 2.5
  const ruleGap = 5
  const emphasizeCount = rows.filter((r) => r.emphasize).length
  const boxHeight = padY * 2 + rows.length * rowH + emphasizeCount * emphasizeTop

  // Clean bordered box — no fill, no shadow
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.45)
  doc.rect(boxX, startY, boxWidth, boxHeight)

  let y = startY + padY + 3.5
  rows.forEach((row) => {
    if (row.emphasize) {
      y += emphasizeTop
      doc.setDrawColor(...RULE_STRONG)
      doc.setLineWidth(0.4)
      doc.line(boxX + padX, y - ruleGap, boxX + boxWidth - padX, y - ruleGap)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(...INK)
    } else {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...INK)
    }
    doc.text(row.label, boxX + padX, y)
    doc.setFont("helvetica", row.emphasize ? "bold" : "normal")
    doc.text(row.value, boxX + boxWidth - padX, y, { align: "right" })
    y += rowH
  })

  return startY + boxHeight + 6
}

function addPaymentAndNotes(
  doc: jsPDF,
  profile: OfficeProfile,
  invoice: InvoiceWithDetails,
  startY: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const paymentRows = [
    ["Bank Name", profile.bankName],
    ["Account Name", profile.accountName],
    ["Account Number", profile.accountNumber],
    ["IFSC", profile.ifsc],
    ["UPI", profile.upiId],
    [upiPaymentNumberLabel(profile.upiPaymentApp), profile.upiPaymentNumber],
  ].filter(([, v]) => Boolean(v)) as [string, string][]

  const terms = invoice.terms || profile.termsAndConditions
  const noteText = pdfText(invoice.notes) || pdfText(terms)
  const hasUpi = Boolean(profile.upiId || profile.upiPaymentNumber)
  const upiApp = getUpiPaymentApp(profile.upiPaymentApp)
  const hasPayment = paymentRows.length > 0 || Boolean(profile.qrCodeDataUrl) || hasUpi
  const hasNotes = Boolean(noteText)

  if (!hasPayment && !hasNotes) return startY

  const qrSize = 32
  const qrReserve = profile.qrCodeDataUrl ? qrSize + 6 : 0
  const contentRight = pageWidth - MARGIN - qrReserve
  const contentWidth = contentRight - MARGIN

  // Estimate footer height and push to new page if needed
  const showUpiApps = Boolean(upiApp || hasUpi || profile.qrCodeDataUrl || profile.upiAppLogos)
  const appsLineH = showUpiApps ? 10 : 0
  const paymentH = hasPayment ? 6 + paymentRows.length * 4.4 + appsLineH + 4 : 0
  const noteLinesPreview = noteText
    ? doc.splitTextToSize(noteText, contentWidth)
    : []
  const notesH = hasNotes ? 6 + Math.min(noteLinesPreview.length, 8) * 3.4 + 2 : 0
  const qrH = profile.qrCodeDataUrl ? qrSize + 4 : 0
  const estimatedH = Math.max(paymentH + notesH, qrH) + 4
  const bottomSafe = pageHeight - 14

  let y = startY
  if (y + estimatedH > bottomSafe) {
    doc.addPage()
    y = MARGIN + 4
  }

  drawHRule(doc, y, pageWidth)
  y += 6

  const blockTop = y

  if (hasPayment) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text("PAYMENT INFORMATION", MARGIN, y)
    y += 5.5

    doc.setFontSize(8)
    paymentRows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...INK)
      doc.text(`${label}:`, MARGIN, y)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...MUTED)
      doc.text(pdfText(value), MARGIN + 38, y, { maxWidth: contentWidth - 38 })
      y += 4.4
    })

    if (showUpiApps) {
      y += 3.2
      const rowH = 3.5
      const logoMaxW = 20
      const gap = 3.4
      const rowTop = y

      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.setTextColor(...INK)
      doc.text("Pay via:", MARGIN, rowTop + rowH * 0.72)
      let x = MARGIN + doc.getTextWidth("Pay via:") + 2.6

      const appsToShow = upiApp ? [upiApp] : UPI_PAYMENT_APPS
      for (const app of appsToShow) {
        const dataUrl =
          profile.upiAppLogos?.[app.id] ??
          (upiApp?.id === app.id ? profile.upiAppLogoDataUrl : null)
        if (!dataUrl) continue
        try {
          const sized = fitLogoSize(doc, dataUrl, logoMaxW, rowH)
          if (x + sized.w > contentRight) break
          const logoY = rowTop + (rowH - sized.h) / 2
          doc.addImage(dataUrl, sized.format, x, logoY, sized.w, sized.h)
          x += sized.w + gap
        } catch {
          // Skip a missing/invalid asset rather than drawing a generic fallback.
        }
      }
      y = rowTop + rowH + 5
    } else {
      y += 3
    }
  }

  if (hasNotes) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text("NOTES & PAYMENT TERMS", MARGIN, y)
    y += 5

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    const noteLines = doc.splitTextToSize(noteText, contentWidth)
    const shown = noteLines.slice(0, 8)
    doc.text(shown, MARGIN, y)
    y += shown.length * 3.4 + 2
  }

  // QR top-aligned with PAYMENT INFORMATION (right side)
  if (profile.qrCodeDataUrl) {
    try {
      const format = profile.qrCodeDataUrl.includes("image/png") ? "PNG" : "JPEG"
      const qrX = pageWidth - MARGIN - qrSize
      // Offset slightly so QR top sits near the section title baseline
      const finalQrY = Math.max(MARGIN, Math.min(blockTop - 2, bottomSafe - qrSize))
      doc.addImage(profile.qrCodeDataUrl, format, qrX, finalQrY, qrSize, qrSize)
      y = Math.max(y, finalQrY + qrSize + 2)
    } catch {
      // skip
    }
  }

  return y + 2
}

export function getInvoicePdfFileName(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_")
  return `Invoice_${safe}.pdf`
}

export function buildInvoicePdfBuffer(
  invoice: InvoiceWithDetails,
  profile: OfficeProfile,
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  // Usable width = A4 210 - margins 24 = 186
  const usableWidth = pageWidth - MARGIN * 2

  let y = addHeader(doc, profile, invoice, MARGIN + 2)
  y = addClientProjectBlock(doc, invoice, y)

  // Price = original rate; Discount = per-unit discount; Amount = (Price − Discount) × Qty
  const colSl = 12
  const colPrice = 28
  const colDiscount = 26
  const colQty = 24
  const colAmount = 30
  const colDesc = usableWidth - colSl - colPrice - colDiscount - colQty - colAmount

  const tableBody = invoice.line_items.map((item, index) => {
    const line = sanitizePdfLineItem(item)
    return [
      String(index + 1),
      pdfText(item.description),
      formatPdfCurrency(line.unit_price),
      formatPdfCurrency(line.discount_amount),
      formatPdfQuantity(line.quantity, item.unit),
      formatPdfCurrency(line.amount),
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [["Sl. No.", "Description", "Price", "Discount", "Qty", "Amount"]],
    body: tableBody.length ? tableBody : [["-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      fontStyle: "normal",
      cellPadding: { top: 2.8, right: 2.2, bottom: 2.8, left: 2.2 },
      textColor: INK,
      lineColor: RULE_STRONG,
      lineWidth: 0.35,
      overflow: "linebreak",
      valign: "middle",
      fillColor: [255, 255, 255],
    },
    headStyles: {
      font: "helvetica",
      fillColor: [245, 245, 245],
      textColor: INK,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 3.2, right: 2.2, bottom: 3.2, left: 2.2 },
      valign: "middle",
      lineColor: RULE_STRONG,
      lineWidth: 0.45,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: colSl, halign: "center" },
      1: { cellWidth: colDesc, halign: "left" },
      2: { cellWidth: colPrice, halign: "right" },
      3: { cellWidth: colDiscount, halign: "right" },
      4: { cellWidth: colQty, halign: "right" },
      5: { cellWidth: colAmount, halign: "right" },
    },
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + 4, bottom: 16 },
    didParseCell: (data) => {
      if (data.section === "head") {
        const align = (
          data.column.index === 0 ? "center" : data.column.index === 1 ? "left" : "right"
        ) as "left" | "center" | "right"
        data.cell.styles.halign = align
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let footerY = ((doc as any).lastAutoTable?.finalY ?? y + 20) + 6
  const summaryReserve = 55

  if (footerY > pageHeight - summaryReserve - 50) {
    doc.addPage()
    footerY = MARGIN + 4
  }

  footerY = addSummaryBlock(doc, invoice, footerY, pageWidth)
  footerY = addPaymentAndNotes(doc, profile, invoice, footerY, pageWidth, pageHeight)

  // Minimal page footer — company details already in header
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    drawHRule(doc, pageHeight - 10, pageWidth)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text("Thank you for your business.", MARGIN, pageHeight - 6)
    if (pages > 1) {
      doc.text(`Page ${i} of ${pages}`, pageWidth - MARGIN, pageHeight - 6, {
        align: "right",
      })
    }
  }

  const arrayBuffer = doc.output("arraybuffer")
  return Buffer.from(arrayBuffer)
}

export function buildInvoiceMailtoLink(
  invoice: InvoiceWithDetails,
  profile: OfficeProfile,
  pdfUrl: string,
): string {
  const subject = encodeURIComponent(
    `Invoice ${invoice.invoice_number} from ${profile.companyName}`,
  )
  const body = encodeURIComponent(
    `Dear ${invoice.client_name},\n\nPlease find your invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total)}.\n\nDownload PDF: ${pdfUrl}\n\nThank you,\n${profile.companyName}`,
  )
  const to = invoice.client_email ? encodeURIComponent(invoice.client_email) : ""
  return `mailto:${to}?subject=${subject}&body=${body}`
}
