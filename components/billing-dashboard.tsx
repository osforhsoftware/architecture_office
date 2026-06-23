"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowUpRight,
  CreditCard,
  IndianRupee,
  Receipt,
  Wallet,
} from "lucide-react"
import { formatCurrency } from "@/lib/constants"
import { PaymentBadge } from "@/components/status-badges"
import { PaymentsDataTable } from "@/components/payments-data-table"
import type { PaginatedResult } from "@/lib/pagination"
import type { BillingOverview, PaymentWithProject } from "@/lib/queries"
import type { Payment } from "@/lib/types"

function FinanceCard({
  label,
  value,
  icon: Icon,
  accent,
  delay = 0,
}: {
  label: string
  value: string
  icon: React.ElementType
  accent: string
  delay?: number
}) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-border/60 bg-card p-5 shadow-premium"
    >
      <div className="flex items-start justify-between">
        <div className={`flex size-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </motion.div>
  )
}

export function BillingDashboard({
  overview,
  paymentsResult,
  recentPayments,
  search,
  invoiceOverview,
  paymentsOnly = false,
}: {
  overview: BillingOverview
  paymentsResult: PaginatedResult<PaymentWithProject>
  recentPayments: (Payment & { project_name: string; project_code: string })[]
  search: string
  invoiceOverview?: {
    totalInvoices: number
    totalBilled: number
    totalCollected: number
    outstanding: number
    overdueCount: number
  }
  paymentsOnly?: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      {!paymentsOnly ? (
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Finance Overview</h2>
          <p className="text-sm text-muted-foreground">
            Revenue, collections, and payment tracking across all projects.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceCard
          label="Total Amount"
          value={formatCurrency(overview.totalAmount)}
          icon={IndianRupee}
          accent="bg-primary/10 text-primary"
          delay={0}
        />
        <FinanceCard
          label="Advance Received"
          value={formatCurrency(overview.advanceReceived)}
          icon={Wallet}
          accent="bg-emerald-500/10 text-emerald-600"
          delay={0.05}
        />
        <FinanceCard
          label="Balance Due"
          value={formatCurrency(overview.balanceDue)}
          icon={CreditCard}
          accent="bg-amber-500/10 text-amber-600"
          delay={0.1}
        />
        <FinanceCard
          label={invoiceOverview ? "Invoices" : "Payment Status"}
          value={
            invoiceOverview
              ? `${invoiceOverview.totalInvoices} invoices`
              : `${overview.paidProjects} paid`
          }
          icon={Receipt}
          accent="bg-violet-500/10 text-violet-600"
          delay={0.15}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border/60 bg-card p-5 shadow-premium lg:col-span-2"
        >
          <h3 className="text-sm font-semibold">Revenue Records</h3>
          <p className="text-xs text-muted-foreground">
            {paymentsResult.total} payment record{paymentsResult.total === 1 ? "" : "s"} in the database
          </p>
          <div className="mt-4">
            <PaymentsDataTable result={paymentsResult} search={search} />
          </div>
        </motion.div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-border/60 bg-card p-5 shadow-premium"
        >
          <h3 className="text-sm font-semibold">Invoice Timeline</h3>
          <p className="text-xs text-muted-foreground">Payment status breakdown</p>
          <div className="mt-4 space-y-4">
            {[
              { label: "Fully Paid", count: overview.paidProjects, color: "bg-emerald-500" },
              { label: "Partially Paid", count: overview.partialProjects, color: "bg-amber-500" },
              { label: "Unpaid", count: overview.unpaidProjects, color: "bg-rose-500" },
            ].map((item) => {
              const total = overview.paidProjects + overview.partialProjects + overview.unpaidProjects
              const pct = total ? Math.round((item.count / total) * 100) : 0
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="font-medium tabular-nums">{item.count}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-6 rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Collection rate</p>
            <p className="text-lg font-semibold">
              {overview.totalAmount
                ? Math.round((overview.advanceReceived / overview.totalAmount) * 100)
                : 0}
              %
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-border/60 bg-card p-5 shadow-premium"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Transaction Log</h3>
            <p className="text-xs text-muted-foreground">Latest payment activity</p>
          </div>
          <Link
            href="/admin/projects"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View projects <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {recentPayments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-medium">{formatCurrency(p.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {p.project_code} · {p.method}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
              <PaymentBadge status={Number(p.amount) > 0 ? "Paid" : "Unpaid"} />
            </div>
          ))}
          {recentPayments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No payments yet.</p>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
