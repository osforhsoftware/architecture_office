import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, MapPin, Phone, User } from "lucide-react"
import { BillingStaffProjectView } from "@/components/billing-staff-project-view"
import { ProjectChecklist } from "@/components/project-checklist"
import { ProjectFilesPanel } from "@/components/project-files-panel"
import { ProjectPaymentsPanel } from "@/components/project-payments-panel"
import { ProjectWorkflowPanel } from "@/components/project-workflow-panel"
import { ProjectActivityFeed } from "@/components/project-activity-feed"
import { WorkflowTimeline } from "@/components/workflow-timeline"
import { PaymentBadge, PriorityBadge, StatusBadge } from "@/components/status-badges"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCurrentUser } from "@/lib/auth"
import {
  formatClientId,
  formatCurrency,
  isBillingStaff,
  projectProgressPercent,
  WORKFLOW_STAGES,
} from "@/lib/constants"
import {
  getChecklist,
  getClient,
  getInvoicesByProject,
  getPayments,
  getProject,
  getProjectFiles,
  getReturnHistory,
  getStaffUsers,
  getStatusHistory,
} from "@/lib/queries"

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user || (!isBillingStaff(user.role) && user.role !== "Admin")) notFound()

  const { id } = await params
  const projectId = Number(id)
  const project = await getProject(projectId)
  if (!project) notFound()

  if (isBillingStaff(user.role) && project.section !== "Billing") notFound()

  const [client, staff, checklist, files, payments, invoices, statusHistory, returnHistory] =
    await Promise.all([
      getClient(project.client_id),
      getStaffUsers(),
      getChecklist(projectId),
      getProjectFiles(projectId),
      getPayments(projectId),
      getInvoicesByProject(projectId),
      getStatusHistory(projectId),
      getReturnHistory(projectId),
    ])

  const progress = projectProgressPercent(project.current_stage)
  const stageLabel = WORKFLOW_STAGES[project.current_stage]?.label ?? "—"

  if (isBillingStaff(user.role)) {
    return (
      <BillingStaffProjectView project={project} payments={payments} invoices={invoices} />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/projects"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to projects
      </Link>

      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-premium">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <StatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
              <PaymentBadge status={project.payment_status} />
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{project.code}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="font-semibold">{formatCurrency(project.project_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="font-semibold">{progress}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due Date</p>
              <p className="font-semibold">
                {project.due_date
                  ? new Date(project.due_date).toLocaleDateString("en-IN")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invoice</p>
              <p className="font-semibold">{project.invoice_number ?? "—"}</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{stageLabel}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="mt-6 border-t border-border/60 pt-6">
          <h3 className="text-sm font-semibold">Client Information</h3>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">{project.client_name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatClientId(project.client_id)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="flex items-center gap-1.5 font-medium">
                {client?.phone ? (
                  <>
                    <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                    {client.phone}
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="flex items-center gap-1.5 font-medium">
                {client?.email ? (
                  <>
                    <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{client.email}</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="flex items-start gap-1.5 font-medium">
                {client?.address ? (
                  <>
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span>{client.address}</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-premium">
        <h3 className="text-sm font-semibold">Workflow Timeline</h3>
        <p className="text-xs text-muted-foreground">End-to-end project pipeline</p>
        <div className="mt-4">
          <WorkflowTimeline section={project.section} status={project.status} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-3">
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Project Information</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium">{project.type ?? "General"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-medium">{project.location ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Department</dt>
                <dd className="font-medium">{project.section}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Stage</dt>
                <dd className="max-w-[140px] truncate text-right font-medium">{stageLabel}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Assigned Staff</h3>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {project.assignee_name ?? "Unassigned"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {project.assignee_name ? "Current assignee" : "Awaiting assignment"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Project Status</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            {project.review_note ? (
              <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                {project.review_note}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:col-span-6">
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Department Progress</h3>
            <ProjectWorkflowPanel
              project={project}
              staff={staff}
              isAdmin
              userRole={user.role}
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <Tabs defaultValue="checklist">
              <TabsList className="mb-4">
                <TabsTrigger value="checklist">Documents</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>
              <TabsContent value="checklist">
                <ProjectChecklist items={checklist} projectId={projectId} isAdmin />
              </TabsContent>
              <TabsContent value="files">
                <ProjectFilesPanel files={files} projectId={projectId} />
              </TabsContent>
              <TabsContent value="billing">
                <ProjectPaymentsPanel project={project} payments={payments} />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:col-span-3">
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <ProjectActivityFeed
              statusHistory={statusHistory}
              returnHistory={returnHistory}
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Comments</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              {project.review_note
                ? project.review_note
                : "No comments yet. Review notes will appear here."}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <div className="mt-3 space-y-2">
              {statusHistory.slice(0, 3).map((h) => (
                <div key={h.id} className="rounded-lg border border-border/50 p-3 text-xs">
                  <p className="font-medium">Status: {h.status}</p>
                  <p className="mt-1 text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
              {statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent updates.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
