import { Suspense } from "react"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import {
  ADMIN_ROLE,
  PROJECT_STATUSES,
  SECTIONS,
  formatCurrency,
} from "@/lib/constants"
import {
  getDashboardStats,
  getKpiSparklines,
  getMonthlyRevenueTrend,
  getProjectsPaginated,
  getRecentPayments,
  getReturnedProjects,
  getStaffPerformance,
} from "@/lib/queries"
import { toSafeNumber } from "@/lib/utils"
import { KpiCard } from "@/components/dashboard/kpi-card"
import {
  DepartmentAnalytics,
  RevenueTrendChart,
  StatusDonutChart,
} from "@/components/dashboard/analytics-charts"
import { ProjectsDataTable } from "@/components/projects-data-table"
import { StatusBadge } from "@/components/status-badges"

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    section?: string
    page?: string
    pageSize?: string
  }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.role === ADMIN_ROLE) redirect("/admin/projects")
  const params = await searchParams
  const search = params.search ?? ""
  const status = params.status ?? "all"
  const section = params.section ?? "all"

  const [stats, sparklines, revenueTrend, projectsResult, returned, payments, staffPerf] =
    await Promise.all([
      getDashboardStats(),
      getKpiSparklines(),
      getMonthlyRevenueTrend(6),
      getProjectsPaginated({
        search,
        status,
        section,
        page: params.page,
        pageSize: params.pageSize,
      }),
      getReturnedProjects(),
      getRecentPayments(5),
      getStaffPerformance(),
    ])

  const currentMonth = toSafeNumber(
    revenueTrend[revenueTrend.length - 1]?.revenue,
    stats.monthlyRevenue,
  )
  const previousMonth = toSafeNumber(revenueTrend[revenueTrend.length - 2]?.revenue)
  const pendingProjects =
    toSafeNumber(stats.pendingReview) +
    toSafeNumber(stats.correctionRequired) +
    toSafeNumber(stats.awaitingAssignment) +
    toSafeNumber(stats.returned)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Executive Overview
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time KPIs, workflow health, and office performance.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Total Clients"
          value={stats.totalClients}
          icon="users"
          sparkline={sparklines.clients}
          trend={8}
          trendLabel="vs last week"
          href="/admin/clients"
          delay={0}
        />
        <KpiCard
          label="Active Projects"
          value={stats.active}
          icon="folder-kanban"
          sparkline={sparklines.projects}
          trend={5}
          href="/admin/projects?status=In%20Progress"
          delay={0.05}
        />
        <KpiCard
          label="Awaiting Assignment"
          value={stats.awaitingAssignment}
          icon="clock"
          href="/admin/projects?status=Awaiting%20Assignment"
          delay={0.1}
        />
        <KpiCard
          label="Pending Review"
          value={stats.pendingReview}
          icon="clock"
          href="/admin/projects?status=Pending%20Review"
          delay={0.12}
        />
        <KpiCard
          label="Correction Required"
          value={stats.correctionRequired}
          icon="clock"
          trend={stats.correctionRequired > 0 ? -3 : 0}
          href="/admin/projects?status=Correction%20Required"
          delay={0.14}
        />
        <KpiCard
          label="Needs Attention"
          value={pendingProjects}
          icon="clock"
          href="/admin/projects"
          delay={0.16}
        />
        <KpiCard
          label="Completed"
          value={stats.completed}
          icon="check-circle"
          trend={12}
          href="/admin/projects?status=Completed"
          delay={0.15}
        />
        <KpiCard
          label="Payments Pending"
          value={stats.paymentsPending}
          icon="wallet"
          trend={stats.paymentsPending > 0 ? -2 : 0}
          href="/admin/billing"
          delay={0.2}
        />
        <KpiCard
          label="Delayed"
          value={stats.delayed}
          icon="calendar"
          href="/admin/projects"
          delay={0.22}
        />
        <KpiCard
          label="Completed Today"
          value={stats.completedToday}
          icon="check-circle"
          delay={0.24}
        />
        <KpiCard
          label="Closed"
          value={stats.closed}
          icon="check-circle"
          href="/admin/projects?status=Closed"
          delay={0.26}
        />
      </div>

      <DepartmentAnalytics data={stats.bySection} />

      <div className="grid gap-4 lg:grid-cols-2">
        <StatusDonutChart data={stats.byStatus} />
        <RevenueTrendChart
          data={revenueTrend}
          currentMonth={currentMonth}
          previousMonth={previousMonth}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Needs Attention</h3>
            <Link href="/admin/projects" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {returned.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/admin/projects/${p.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.code}</p>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
            {returned.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">All clear.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium lg:col-span-1">
          <h3 className="mb-4 text-sm font-semibold">Staff Performance</h3>
          <div className="space-y-3">
            {staffPerf.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.role}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-medium text-primary">{s.assigned} active</p>
                  <p className="text-muted-foreground">{s.completed} done</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium lg:col-span-1">
          <h3 className="mb-4 text-sm font-semibold">Recent Payments</h3>
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 p-3 text-sm">
                <div>
                  <p className="font-medium">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">{p.project_code}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("en-IN")}
                </span>
              </div>
            ))}
            {payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No payments yet.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">All Projects</h3>
            <p className="text-sm text-muted-foreground">Search, filter, and manage project pipeline</p>
          </div>
          <Link
            href="/admin/projects"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Full view <ArrowRight className="size-4" />
          </Link>
        </div>
        <Suspense>
          <ProjectsDataTable
            result={projectsResult}
            search={search}
            status={status}
            section={section}
            statusOptions={[...PROJECT_STATUSES]}
            sectionOptions={[...SECTIONS]}
          />
        </Suspense>
      </div>

    </div>
  )
}
