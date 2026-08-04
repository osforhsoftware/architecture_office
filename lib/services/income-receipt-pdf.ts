import "server-only"

import { jsPDF } from "jspdf"
import type { FinanceIncome } from "@/lib/finance/types"
import type { OfficeProfile } from "@/lib/types"

function pdfText(value: string | null | undefined): string {
  if (!value) return ""
  return String(value)
    .replace(/\u20b9/g, "Rs.")
    .replace(/[^\x00-\x7F]/g, "")
}

function formatPdfCurrency(value: number | string): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  const amount = Number.isFinite(n) ? n : 0
  return `Rs. ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`
}

export function getIncomeReceiptPdfFileName(receiptNumber: string): string {
  return `Receipt_${receiptNumber.replace(/[^\w-]+/g, "_")}.pdf`
}

export function buildIncomeReceiptPdfBuffer(
  income: FinanceIncome,
  profile: OfficeProfile | null,
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 18

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(pdfText(profile?.companyName ?? "Architecture Office"), 15, y)

  y += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  if (profile?.address) {
    doc.text(pdfText(profile.address), 15, y)
    y += 5
  }
  if (profile?.phone || profile?.email) {
    doc.text(pdfText([profile.phone, profile.email].filter(Boolean).join(" | ")), 15, y)
    y += 5
  }

  y += 6
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("PAYMENT RECEIPT", pageWidth / 2, y, { align: "center" })

  y += 12
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")

  const rows: [string, string][] = [
    ["Receipt No.", pdfText(income.receipt_number)],
    ["Date", pdfText(new Date(income.income_date).toLocaleDateString("en-IN"))],
    ["Client", pdfText(income.client_name ?? "—")],
    ["Project", pdfText(income.project_name ?? "—")],
    ["Category", pdfText(income.category_name ?? "—")],
    ["Payment Method", pdfText(income.payment_method)],
    ["Reference", pdfText(income.reference_number ?? "—")],
    ["Status", pdfText(income.status)],
  ]

  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold")
    doc.text(`${label}:`, 15, y)
    doc.setFont("helvetica", "normal")
    doc.text(value, 55, y)
    y += 7
  }

  y += 4
  doc.setDrawColor(160, 160, 160)
  doc.line(15, y, pageWidth - 15, y)
  y += 10

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("Amount Received:", 15, y)
  doc.text(formatPdfCurrency(income.amount), pageWidth - 15, y, { align: "right" })

  if (income.notes) {
    y += 12
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("Notes:", 15, y)
    y += 6
    doc.setFont("helvetica", "normal")
    const lines = doc.splitTextToSize(pdfText(income.notes), pageWidth - 30)
    doc.text(lines, 15, y)
  }

  y = doc.internal.pageSize.getHeight() - 20
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text("This is a computer-generated receipt.", pageWidth / 2, y, { align: "center" })

  return Buffer.from(doc.output("arraybuffer"))
}
