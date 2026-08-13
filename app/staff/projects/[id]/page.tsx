import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectChecklist } from "@/components/project-checklist"
import { ProjectDrawingNumberPanel } from "@/components/project-drawing-number-panel"
import { ProjectKmapPanel } from "@/components/project-kmap-panel"
import { ProjectFilesPanel } from "@/components/project-files-panel"
import { ProjectHistoryPanel } from "@/components/project-history-panel"
import { ProjectWorkflowPanel } from "@/components/project-workflow-panel"
import { PriorityBadge, StatusBadge } from "@/components/status-badges"
import { getCurrentUser } from "@/lib/auth"
import { isOfficeAdmin, projectProgressPercent, userIsPlanningStaff } from "@/lib/constants"
import { getDepartmentNames, getSectionRoleMap } from "@/lib/departments"
import {
  getChecklist,
  getCurrentWorkflowStep,
  getProject,
  getProjectFiles,
  getProjectKmapAreas,
  getReturnHistory,
  getStaffUsers,
  getStatusHistory,
  getWorkflowSteps,
} from "@/lib/queries"
import {
  requireProjectAccess,
  staffCanEditProject,
  staffContributedToProject,
} from "@/lib/project-access"
import { Progress } from "@/components/ui/progress"

export default async function StaffProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user || isOfficeAdmin(user.role)) redirect("/login")

  const { id } = await params
  const projectId = Number(id)
  const project = await getProject(projectId)
  if (!project) notFound()

  const contributed = await staffContributedToProject(user, projectId)
  if (!contributed) {
    try {
      await requireProjectAccess(user, projectId)
    } catch {
      notFound()
    }
  }

  const canEdit = staffCanEditProject(user, project)
  const isPlanningStaff = userIsPlanningStaff(user)
  const showDrawingNumberPanel = isPlanningStaff || project.drawing_number
  const canEditDrawingNumber =
    isPlanningStaff && canEdit && project.section === "Planning & Design"

  const [staff, checklist, files, statusHistory, returnHistory, kmapAreas, workflowSteps, currentStep, departmentOptions, sectionRoleMap] = await Promise.all([
    getStaffUsers(),
    getChecklist(projectId),
    getProjectFiles(projectId),
    getStatusHistory(projectId),
    getReturnHistory(projectId),
    getProjectKmapAreas(projectId),
    getWorkflowSteps(projectId),
    getCurrentWorkflowStep(projectId),
    getDepartmentNames(true),
    getSectionRoleMap(),
  ])

  const stage = currentStep
  const progress = projectProgressPercent(project.current_stage, workflowSteps)
  const myReturns = returnHistory.filter((r) => r.created_by === user.name)
  const myStatusEntries = statusHistory.filter((h) => h.created_by === user.name)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link
        href="/staff/projects"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to my projects
      </Link>

      <Card className="shadow-none">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold md:text-xl">{project.name}</h2>
            <StatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.code} · {project.client_name}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {project.section} · {stage?.label ?? "—"}
          </p>
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          {project.notes?.trim() ? (
            <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Project note</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{project.notes}</p>
            </div>
          ) : null}
          {!canEdit ? (
            <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {project.status === "Returned"
                ? "You returned this project. You can view your work details and track status here."
                : "View-only — this project is no longer in your active queue."}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectWorkflowPanel
              project={project}
              workflowSteps={workflowSteps}
              currentStep={currentStep}
              staff={staff}
              canStaffAct
              userRole={user.role}
              readOnly={false}
              departmentOptions={departmentOptions}
              sectionRoleMap={sectionRoleMap}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Current status</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectWorkflowPanel
              project={project}
              workflowSteps={workflowSteps}
              currentStep={currentStep}
              staff={staff}
              userRole={user.role}
              readOnly
              departmentOptions={departmentOptions}
              sectionRoleMap={sectionRoleMap}
            />
          </CardContent>
        </Card>
      )}

      {(myReturns.length > 0 || myStatusEntries.length > 0) && !canEdit ? (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your work on this project</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {myReturns.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Returned: {r.reason}</p>
                {r.notes ? <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p> : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
            {myStatusEntries.slice(0, 5).map((h) => (
              <div key={h.id} className="border-l-2 border-primary/30 pl-3">
                <p className="text-sm font-medium">{h.status}</p>
                {h.note ? <p className="text-xs text-muted-foreground">{h.note}</p> : null}
                <p className="text-[11px] text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {showDrawingNumberPanel ? (
        <Card className="shadow-none">
          <CardContent className="p-4 md:p-6">
            <ProjectDrawingNumberPanel
              projectId={projectId}
              drawingNumber={project.drawing_number}
              edgebookNumber={project.edgebook_number}
              readOnly={!canEditDrawingNumber}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-none">
        <CardContent className="p-4 md:p-6">
          <ProjectKmapPanel
            projectId={projectId}
            areas={kmapAreas}
            readOnly={!canEdit}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="checklist" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="checklist" className="mt-4">
          <Card className="shadow-none">
            <CardContent className="p-4 md:p-6">
              <ProjectChecklist
                items={checklist}
                projectId={projectId}
                readOnly={!canEdit || project.status === "Closed"}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <Card className="shadow-none">
            <CardContent className="p-4 md:p-6">
              <ProjectFilesPanel
                files={files}
                projectId={projectId}
                readOnly={!canEdit || project.status === "Closed"}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <ProjectHistoryPanel statusHistory={statusHistory} returnHistory={returnHistory} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
