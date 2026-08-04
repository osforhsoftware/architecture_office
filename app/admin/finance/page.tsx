import Link from "next/link"
import { FolderKanban, Building2 } from "lucide-react"
import { PROJECT_FINANCE_BASE, OFFICE_FINANCE_BASE } from "@/lib/finance/constants"

const sections = [
  {
    href: PROJECT_FINANCE_BASE,
    title: "Project Finance",
    description: "Income, expenses, budgets, and profit by project. Never mixes with office overhead.",
    icon: FolderKanban,
  },
  {
    href: OFFICE_FINANCE_BASE,
    title: "Office Finance",
    description: "Cash book, accounts, vendors, salary, and office operating expenses.",
    icon: Building2,
  },
]

export default function FinanceHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Finance Hub</h2>
        <p className="text-sm text-muted-foreground">
          Choose Project Finance for client work, or Office Finance for company operations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-xl border border-border/60 bg-card p-6 shadow-premium transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <section.icon className="size-8 text-primary" />
            <h3 className="mt-4 text-lg font-semibold group-hover:text-primary">{section.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
