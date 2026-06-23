import Link from "next/link"
import {
  Users,
  FolderKanban,
  Activity,
  Clock,
  RotateCcw,
  CheckCircle2,
  Wallet,
  TriangleAlert,
  CalendarDays,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getDashboardStats,
  getProjects,
  getRecentPayments,
  getReturnedProjects,
  getStaffPerformance,
} from "@/lib/queries"
import { formatCurrency } from "@/lib/constants"
import { SectionBarChart, StatusPieChart } from "@/components/dashboard-charts"
import { StatusBadge, PriorityBadge } from "@/components/status-badges"

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  href,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  accent: string
  href?: string
}) {
  const content = (
    <Card className={href ? "transition-shadow hover:shadow-md" : undefined}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

export default async function AdminDashboard() {
  const [stats, recent, returned, payments, staffPerf] = await Promise.all([
    getDashboardStats(),
    getProjects(),
    getReturnedProjects(),
    getRecentPayments(5),
    getStaffPerformance(),
  ])
  const recentProjects = recent.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Office Overview</h2>
        <p className="text-sm text-muted-foreground">
          KPIs, workflow health, and recent activity across the office.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total Clients" value={stats.totalClients} icon={Users} accent="bg-slate-100 text-slate-700" href="/admin/clients" />
        <StatCard label="Active Projects" value={stats.active} icon={Activity} accent="bg-amber-100 text-amber-700" href="/admin/projects?status=In%20Progress" />
        <StatCard label="Pending Review" value={stats.pendingReview} icon={Clock} accent="bg-violet-100 text-violet-700" href="/admin/projects?status=Pending%20Review" />
        <StatCard label="Returned" value={stats.returned} icon={RotateCcw} accent="bg-red-100 text-red-600" href="/admin/projects?status=Returned" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} accent="bg-green-100 text-green-700" href="/admin/projects?status=Completed" />
        <StatCard label="Payments Pending" value={stats.paymentsPending} icon={TriangleAlert} accent="bg-orange-100 text-orange-700" />
        <StatCard label="Today's Tasks" value={stats.todaysTasks} icon={CalendarDays} accent="bg-blue-100 text-blue-700" />
        <StatCard label="Monthly Revenue" value={formatCurrency(stats.monthlyRevenue)} icon={Wallet} accent="bg-emerald-100 text-emerald-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.bySection.length ? (
              <SectionBarChart data={stats.bySection} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byStatus.length ? (
              <StatusPieChart data={stats.byStatus} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Needs attention</CardTitle>
            <Link href="/admin/projects" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {returned.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/admin/projects/${p.id}`}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.code} · {p.section}</p>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
            {returned.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing needs attention.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff performance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {staffPerf.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.role}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{s.assigned} active</p>
                  <p>{s.completed} done</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Projects</CardTitle>
            <Link href="/admin/projects" className="flex items-center gap-1 text-sm text-primary hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {recentProjects.map((p) => (
              <Link
                key={p.id}
                href={`/admin/projects/${p.id}`}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.code} · {p.client_name} · {p.section}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PriorityBadge priority={p.priority} />
                  <StatusBadge status={p.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm">
                <div>
                  <p className="font-medium">{formatCurrency(p.amount)} · {p.method}</p>
                  <p className="text-xs text-muted-foreground">{p.project_code} · {p.project_name}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("en-IN")}
                </span>
              </div>
            ))}
            {payments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payments yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-muted-foreground">Total collected</p>
            <p className="text-xl font-semibold">{formatCurrency(stats.totalRevenue)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-xl font-semibold">{formatCurrency(stats.outstanding)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">All projects</p>
            <p className="text-xl font-semibold">{stats.total}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
