import "server-only"

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { formatCurrency } from "@/lib/constants"
import { formatInvoiceDate } from "@/lib/invoice-utils"
import type { InvoiceWithDetails, OfficeProfile } from "@/lib/types"

/** ASCII-safe text for jsPDF built-in fonts (no Unicode symbols). */
function pdfText(value: string | null | undefined): string {
  if (!value) return ""
  return String(value)
    .replace(/\u00b7/g, "|")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u20b9/g, "Rs.")
    .replace(/[^\x00-\x7F]/g, "")
}

/**
 * PDF-safe currency — jsPDF Helvetica cannot render the INR (Rs.) glyph;
 * using Intl currency style causes broken spacing and wrong characters.
 */
function formatPdfCurrency(value: number | string): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  const amount = Number.isFinite(n) ? n : 0
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `Rs. ${formatted}`
}

function formatPdfQuantity(value: number | string): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return "0.00"
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function addHeader(
  doc: jsPDF,
  profile: OfficeProfile,
  invoice: InvoiceWithDetails,
  startY: number,
): number {
  let y = startY
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14

  if (profile.logoDataUrl) {
    try {
      const format = profile.logoDataUrl.includes("image/png") ? "PNG" : "JPEG"
      doc.addImage(profile.logoDataUrl, format, margin, y, 28, 28)
    } catch {
      // skip invalid logo
    }
  }

  const textX = profile.logoDataUrl ? margin + 34 : margin
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text(pdfText(profile.companyName) || "Company", textX, y + 6)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  const companyLines = [
    pdfText(profile.address),
    pdfText([profile.phone, profile.email, profile.website].filter(Boolean).join(" | ")),
    profile.gstNumber ? `GST: ${pdfText(profile.gstNumber)}` : "",
  ].filter(Boolean)
  companyLines.forEach((line, i) => {
    doc.text(line, textX, y + 12 + i * 5)
  })

  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.setTextColor(30, 30, 30)
  doc.text("INVOICE", pageWidth - margin, y + 8, { align: "right" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`# ${pdfText(invoice.invoice_number)}`, pageWidth - margin, y + 16, {
    align: "right",
  })
  doc.text(`Date: ${formatInvoiceDate(invoice.invoice_date)}`, pageWidth - margin, y + 22, {
    align: "right",
  })
  if (invoice.due_date) {
    doc.text(`Due: ${formatInvoiceDate(invoice.due_date)}`, pageWidth - margin, y + 28, {
      align: "right",
    })
  }
  if (invoice.project_code) {
    doc.text(`Project: ${pdfText(invoice.project_code)}`, pageWidth - margin, y + 34, {
      align: "right",
    })
  }

  y += invoice.project_code ? 44 : 38
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, y, pageWidth - margin, y)
  return y + 8
}

function addClientBlock(doc: jsPDF, invoice: InvoiceWithDetails, startY: number): number {
  const margin = 14
  let y = startY

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text("BILL TO", margin, y)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(pdfText(invoice.client_name), margin, y + 7)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  const clientLines = [
    pdfText(invoice.client_address),
    pdfText([invoice.client_phone, invoice.client_email].filter(Boolean).join(" | ")),
    invoice.client_tax_id ? `GST: ${pdfText(invoice.client_tax_id)}` : "",
    invoice.project_name ? `Project: ${pdfText(invoice.project_name)}` : "",
  ].filter(Boolean) as string[]

  clientLines.forEach((line, i) => {
    doc.text(line, margin, y + 14 + i * 5)
  })

  return y + 14 + clientLines.length * 5 + 6
}

function addSummaryBlock(
  doc: jsPDF,
  invoice: InvoiceWithDetails,
  startY: number,
  margin: number,
  pageWidth: number,
): number {
  const boxWidth = 78
  const boxX = pageWidth - margin - boxWidth
  const rowHeight = 6
  const rows = [
    { label: "Subtotal", value: formatPdfCurrency(invoice.subtotal), bold: false },
    {
      label: `Tax (${invoice.tax_percent}%)`,
      value: formatPdfCurrency(invoice.tax_amount),
      bold: false,
    },
    {
      label: `Discount (${invoice.discount_percent}%)`,
      value: `-${formatPdfCurrency(invoice.discount_amount)}`,
      bold: false,
    },
    { label: "Total", value: formatPdfCurrency(invoice.total), bold: true },
    { label: "Amount Paid", value: formatPdfCurrency(invoice.amount_paid), bold: false },
    { label: "Balance Due", value: formatPdfCurrency(invoice.balance), bold: true },
  ]

  const boxHeight = rows.length * rowHeight + 8
  doc.setFillColor(248, 249, 252)
  doc.setDrawColor(220, 224, 230)
  doc.roundedRect(boxX, startY - 4, boxWidth, boxHeight, 2, 2, "FD")

  rows.forEach((row, i) => {
    const y = startY + i * rowHeight
    doc.setFont("helvetica", row.bold ? "bold" : "normal")
    doc.setFontSize(row.label === "Total" || row.label === "Balance Due" ? 10 : 9)
    doc.setTextColor(row.bold ? 30 : 70, row.bold ? 30 : 70, row.bold ? 30 : 70)
    doc.text(row.label, boxX + 4, y)
    doc.text(row.value, boxX + boxWidth - 4, y, { align: "right" })
  })

  return startY + boxHeight + 6
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
  const margin = 14

  let y = addHeader(doc, profile, invoice, 16)
  y = addClientBlock(doc, invoice, y)

  const tableBody = invoice.line_items.map((item) => [
    pdfText(item.description),
    formatPdfQuantity(item.quantity),
    formatPdfCurrency(item.unit_price),
    formatPdfCurrency(item.amount),
  ])

  autoTable(doc, {
    startY: y,
    head: [["DESCRIPTION", "SQFT / M2", "RATE", "AMOUNT"]],
    body: tableBody.length ? tableBody : [["-", "-", "-", "-"]],
    theme: "grid",
    showHead: "firstPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    headStyles: {
      font: "helvetica",
      fillColor: [220, 220, 220],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 88 },
      1: { halign: "right", cellWidth: 28 },
      2: { halign: "right", cellWidth: 32 },
      3: { halign: "right", cellWidth: 32 },
    },
    margin: { left: margin, right: margin },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20
  let footerY = addSummaryBlock(doc, invoice, finalY + 10, margin, pageWidth)
  const pageHeight = doc.internal.pageSize.getHeight()
  const bottomMargin = 14

  if (footerY > pageHeight - bottomMargin) {
    doc.addPage()
    footerY = 16
  }

  if (invoice.notes) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.text("Notes", margin, footerY)
    doc.setFont("helvetica", "normal")
    const noteLines = doc.splitTextToSize(pdfText(invoice.notes), pageWidth - margin * 2)
    doc.text(noteLines, margin, footerY + 6)
    footerY += 6 + noteLines.length * 4 + 6
  }

  const terms = invoice.terms || profile.termsAndConditions
  if (terms) {
    if (footerY > pageHeight - bottomMargin) {
      doc.addPage()
      footerY = 16
    }
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text("Terms & Conditions", margin, footerY)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(90, 90, 90)
    const termLines = doc.splitTextToSize(pdfText(terms), pageWidth - margin * 2)
    doc.text(termLines, margin, footerY + 6)
    footerY += 6 + termLines.length * 3.5 + 8
  }

  footerY += 4
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, footerY, pageWidth - margin, footerY)
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  const footerText = pdfText(
    [profile.companyName, [profile.phone, profile.email].filter(Boolean).join(" | ")]
      .filter(Boolean)
      .join(" | "),
  )
  doc.text(footerText, pageWidth / 2, footerY + 5, { align: "center" })

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
