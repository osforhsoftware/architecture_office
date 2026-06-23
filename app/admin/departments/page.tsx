import Link from "next/link"
import { getDepartmentStats } from "@/lib/queries"
import { ArrowRight, Building2 } from "lucide-react"

export default async function AdminDepartmentsPage() {
  const departments = await getDepartmentStats()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Teams</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Departments</h2>
        <p className="text-sm text-muted-foreground">
          Workflow distribution across office departments.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d, i) => (
          <div
            key={d.section}
            className="rounded-xl border border-border/60 bg-card p-5 shadow-premium transition-all hover:border-primary/20 hover:shadow-premium-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <span className="text-xs text-muted-foreground">{d.staff} staff</span>
            </div>
            <h3 className="mt-4 font-semibold">{d.section}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-xl font-semibold text-primary">{d.active}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-xl font-semibold">{d.completed}</p>
              </div>
            </div>
            <Link
              href={`/admin/projects?section=${encodeURIComponent(d.section)}`}
              className="mt-4 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View projects <ArrowRight className="size-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
