import "server-only"

import { sql } from "@/lib/db"

function pad(n: number, width = 4): string {
  return String(n).padStart(width, "0")
}

type NumRow = { num?: string }

function bump(seq: number, last?: string): number {
  if (!last) return seq
  const n = Number.parseInt(last.split("-").pop() ?? "0", 10)
  return Number.isFinite(n) && n + 1 > seq ? n + 1 : seq
}

export async function nextReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const like = `RCP-${year}-%`
  const [a, b, c] = (await Promise.all([
    sql`SELECT receipt_number AS num FROM project_income WHERE receipt_number LIKE ${like} ORDER BY id DESC LIMIT 1`,
    sql`SELECT receipt_number AS num FROM office_income WHERE receipt_number LIKE ${like} ORDER BY id DESC LIMIT 1`,
    sql`SELECT receipt_number AS num FROM finance_income WHERE receipt_number LIKE ${like} ORDER BY id DESC LIMIT 1`,
  ])) as [NumRow[], NumRow[], NumRow[]]
  let seq = 1
  seq = bump(seq, a[0]?.num)
  seq = bump(seq, b[0]?.num)
  seq = bump(seq, c[0]?.num)
  return `RCP-${year}-${pad(seq)}`
}

export async function nextExpenseNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const like = `EXP-${year}-%`
  const [a, b, c] = (await Promise.all([
    sql`SELECT expense_number AS num FROM project_expenses WHERE expense_number LIKE ${like} ORDER BY id DESC LIMIT 1`,
    sql`SELECT expense_number AS num FROM office_expenses WHERE expense_number LIKE ${like} ORDER BY id DESC LIMIT 1`,
    sql`SELECT expense_number AS num FROM finance_expenses WHERE expense_number LIKE ${like} ORDER BY id DESC LIMIT 1`,
  ])) as [NumRow[], NumRow[], NumRow[]]
  let seq = 1
  seq = bump(seq, a[0]?.num)
  seq = bump(seq, b[0]?.num)
  seq = bump(seq, c[0]?.num)
  return `EXP-${year}-${pad(seq)}`
}

export async function nextClaimNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const rows = (await sql`
    SELECT claim_number AS num FROM staff_expenses
    WHERE claim_number LIKE ${`CLM-${year}-%`}
    ORDER BY id DESC LIMIT 1
  `) as NumRow[]
  return `CLM-${year}-${pad(bump(1, rows[0]?.num))}`
}

export async function nextTransferNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const rows = (await sql`
    SELECT transfer_number AS num FROM bank_transfers
    WHERE transfer_number LIKE ${`TRF-${year}-%`}
    ORDER BY id DESC LIMIT 1
  `) as NumRow[]
  return `TRF-${year}-${pad(bump(1, rows[0]?.num))}`
}

export async function nextTxnNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const rows = (await sql`
    SELECT transaction_number AS num FROM finance_transactions
    WHERE transaction_number LIKE ${`TXN-${year}-%`}
    ORDER BY id DESC LIMIT 1
  `) as NumRow[]
  return `TXN-${year}-${pad(bump(1, rows[0]?.num))}`
}

export async function nextPayslipNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const rows = (await sql`
    SELECT payslip_number AS num FROM salary_payroll
    WHERE payslip_number LIKE ${`PAY-${year}-%`}
    ORDER BY id DESC LIMIT 1
  `) as NumRow[]
  return `PAY-${year}-${pad(bump(1, rows[0]?.num))}`
}
