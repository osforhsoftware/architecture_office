import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, MapPin, Phone, Wallet } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"
import { ApprovalHistory } from "@/components/approval-history"
import { AdditionalRequirementsSection } from "@/components/additional-requirements-section"
import { BillingStaffProjectView } from "@/components/billing-staff-project-view"
import { ProjectBillingPanel } from "@/components/project-billing-panel"
import { ProjectChecklist } from "@/components/project-checklist"
import { ProjectDrawingNumberPanel } from "@/components/project-drawing-number-panel"
import { ProjectEditDialog } from "@/components/project-edit-dialog"
import { ProjectStartDatePanel } from "@/components/project-start-date-field"
import { ProjectNotesPanel } from "@/components/project-notes-field"
import { ProjectKmapPanel } from "@/components/project-kmap-panel"
import { ProjectFilesPanel } from "@/components/project-files-panel"
import { ProjectDetailsSaveShell } from "@/components/project-details-save"
import { ProjectPrintButton } from "@/components/project-print-button"
import { ProjectDeleteDialog } from "@/components/project-delete-dialog"
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
  isOfficeAdmin,
  isSuperAdmin,
  projectProgressPercent,
  userIsBillingStaff,
} from "@/lib/constants"
import { getDepartmentNames, getSectionRoleMap } from "@/lib/departments"
import {
  getProjectAdditionalRequirements,
  listAdditionalRequirementTemplates,
  toAdditionalRequirementOption,
} from "@/lib/additional-requirements"
import { listDocumentTemplates, toDocumentOption } from "@/lib/document-templates"
import { listProjectServiceDefs } from "@/lib/project-services"
import { getProjectDeleteBlockers } from "@/lib/project-delete"
import {
  getChecklist,
  getClient,
  getClients,
  getCurrentWorkflowStep,
  getInvoicesByProject,
  getPayments,
  getProject,
  getProjectFiles,
  getProjectKmapAreas,
  getProjectServices,
  getReturnHistory,
  getStaffUsers,
  getStatusHistory,
  getWorkflowReviews,
  getWorkflowSteps,
} from "@/lib/queries"

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user || (!userIsBillingStaff(user) && !isOfficeAdmin(user.role))) notFound()

  const { id } = await params
  const projectId = Number(id)
  const project = await getProject(projectId)
  if (!project) notFound()

  const billingOnly = userIsBillingStaff(user) && user.role === "Billing Staff"
  if (billingOnly && project.section !== "Billing") notFound()

  const superAdmin = isSuperAdmin(user.role)
  /** Closed projects are read-only except for Super Admin. Billing remains available. */
  const detailsReadOnly = project.status === "Closed" && !superAdmin

  const [client, staff, checklist, files, payments, invoices, statusHistory, returnHistory, reviews, kmapAreas, workflowSteps, currentStep, departmentOptions, sectionRoleMap, additionalRequirements, customFieldTemplates, deleteBlockers, clients, serviceDefs, documentRows, projectServiceKeys] =
    await Promise.all([
      getClient(project.client_id),
      getStaffUsers(),
      getChecklist(projectId),
      getProjectFiles(projectId),
      getPayments(projectId),
      getInvoicesByProject(projectId),
      getStatusHistory(projectId),
      getReturnHistory(projectId),
      getWorkflowReviews(projectId),
      getProjectKmapAreas(projectId),
      getWorkflowSteps(projectId),
      getCurrentWorkflowStep(projectId),
      getDepartmentNames(true),
      getSectionRoleMap(),
      getProjectAdditionalRequirements(projectId),
      listAdditionalRequirementTemplates({ activeOnly: true }),
      getProjectDeleteBlockers(projectId),
      getClients(),
      listProjectServiceDefs({ includeInactive: true }),
      listDocumentTemplates({ includeInactive: true }),
      getProjectServices(projectId),
    ])

  const customFieldOptions = customFieldTemplates.map(toAdditionalRequirementOption)
  const documentTemplates = documentRows.map(toDocumentOption)
  const visibleServices = serviceDefs.filter(
    (service) => service.active !== false || projectServiceKeys.includes(service.key),
  )

  const progress = projectProgressPercent(project.current_stage, workflowSteps)
  const stageLabel = currentStep?.label ?? "—"
  const assignee =
    staff.find((s) => s.id === project.assigned_to) ??
    staff.find((s) => project.site_assignee_ids?.includes(s.id))
  const teamAssignees = (project.site_assignee_ids ?? [])
    .map((id) => staff.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
  const assignedAt = statusHistory.find((h) => h.status === "Assigned")?.created_at
  const assignedAtLabel = assignedAt
    ? new Date(assignedAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null

  if (billingOnly) {
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

      <ProjectDetailsSaveShell projectId={projectId} enabled={!detailsReadOnly}>
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
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!detailsReadOnly ? (
                <ProjectEditDialog
                  project={project}
                  clients={clients}
                  services={visibleServices}
                  documentTemplates={documentTemplates}
                  additionalRequirementOptions={customFieldOptions}
                  additionalRequirements={additionalRequirements}
                  selectedServiceKeys={projectServiceKeys}
                  checklist={checklist}
                  canSetStartDate={superAdmin}
                />
              ) : null}
              <Link
                href={`/admin/finance/project/${project.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Wallet className="size-4" /> Project Finance
              </Link>
              <ProjectPrintButton projectId={project.id} />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-semibold">{formatCurrency(project.project_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="font-semibold">{progress}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Started</p>
                <p className="font-semibold">
                  {project.created_at
                    ? new Date(project.created_at).toLocaleDateString("en-IN")
                    : "—"}
                </p>
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
          <WorkflowTimeline workflowSteps={workflowSteps} status={project.status} />
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
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Drawing No.</dt>
                <dd className="font-medium">{project.drawing_number ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">MBook No.</dt>
                <dd className="font-medium">{project.edgebook_number ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground shrink-0">Refer name</dt>
                <dd className="max-w-[160px] truncate text-right font-medium">
                  {project.refer_name ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Started</dt>
                <dd className="font-medium">
                  {project.created_at
                    ? new Date(project.created_at).toLocaleDateString("en-IN")
                    : "—"}
                </dd>
              </div>
            </dl>
            {superAdmin ? (
              <div className="mt-4 border-t border-border/60 pt-4">
                <ProjectStartDatePanel
                  projectId={projectId}
                  createdAt={project.created_at}
                  readOnly={detailsReadOnly}
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Assigned Staff</h3>
            <div className="mt-4 flex items-center gap-3">
              <UserAvatar
                name={assignee?.name ?? project.assignee_name ?? "Unassigned"}
                avatarUrl={assignee?.avatar_url}
                className="size-10"
                textClassName="bg-primary/10 text-sm text-primary"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {project.assignee_name ?? "Unassigned"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {project.assignee_name ? "Primary assignee" : "Awaiting assignment"}
                </p>
                {assignedAtLabel ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Assigned {assignedAtLabel}
                  </p>
                ) : null}
              </div>
            </div>
            {teamAssignees.length > 1 ? (
              <div className="mt-4 rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Assigned team</p>
                <ul className="mt-2 space-y-2">
                  {teamAssignees.map((member) => (
                    <li key={member.id} className="flex items-center gap-2">
                      <UserAvatar
                        name={member.name}
                        avatarUrl={member.avatar_url}
                        className="size-7"
                        textClassName="bg-background text-[10px] text-muted-foreground"
                      />
                      <span className="truncate text-sm">{member.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
              workflowSteps={workflowSteps}
              currentStep={currentStep}
              staff={staff}
              isSuperAdmin={superAdmin}
              userRole={user.role}
              readOnly={detailsReadOnly}
              departmentOptions={departmentOptions}
              sectionRoleMap={sectionRoleMap}
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <ProjectDrawingNumberPanel
              projectId={projectId}
              drawingNumber={project.drawing_number}
              edgebookNumber={project.edgebook_number}
              readOnly={detailsReadOnly}
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <ProjectKmapPanel
              projectId={projectId}
              areas={kmapAreas}
              readOnly={detailsReadOnly}
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <Tabs defaultValue="checklist">
              <TabsList className="mb-4 h-auto flex-wrap">
                <TabsTrigger value="checklist">Documents</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>
              <TabsContent value="checklist">
                <ProjectChecklist
                  items={checklist}
                  projectId={projectId}
                  readOnly={detailsReadOnly}
                />
              </TabsContent>
              <TabsContent value="files">
                <ProjectFilesPanel
                  files={files}
                  projectId={projectId}
                  readOnly={detailsReadOnly}
                />
              </TabsContent>
              <TabsContent value="custom-fields">
                <AdditionalRequirementsSection
                  projectId={projectId}
                  requirements={additionalRequirements}
                  options={customFieldOptions}
                  readOnly={detailsReadOnly}
                />
              </TabsContent>
              <TabsContent value="billing">
                <ProjectBillingPanel
                  project={project}
                  payments={payments}
                  invoices={invoices}
                />
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
            <ApprovalHistory reviews={reviews} />
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <ProjectNotesPanel
              projectId={projectId}
              notes={project.notes}
              reviewNote={project.review_note}
              readOnly={detailsReadOnly}
            />
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
      </ProjectDetailsSaveShell>

      <div className="flex justify-start">
        <ProjectDeleteDialog
          projectId={project.id}
          projectName={project.name}
          projectCode={project.code}
          blockers={deleteBlockers}
        />
      </div>
    </div>
  )
}
