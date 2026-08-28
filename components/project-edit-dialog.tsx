"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormMultiSelect } from "@/components/form-multi-select"
import { FormSelect } from "@/components/form-select"
import { FormField, FormSection, formControlClass } from "@/components/form-section"
import { ResidentialPropertyFields } from "@/components/residential-details-section"
import { AdditionalRequirementsFields } from "@/components/additional-requirements-fields"
import { DrawingNumberField } from "@/components/project-drawing-number-panel"
import { ProjectNotesField } from "@/components/project-notes-field"
import { ProjectStartDateField } from "@/components/project-start-date-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateProjectDetails } from "@/lib/actions"
import {
  PRIORITIES,
  PROJECT_TYPES,
  RESIDENTIAL_SERVICE_TYPES,
  showsResidentialDetails,
  showsResidentialPropertyFields,
  type ResidentialServiceKey,
} from "@/lib/constants"
import { localDateInputValue } from "@/lib/project-dates"
import {
  serviceByKey,
  type DocumentTemplateOption,
  type ProjectServiceDef,
  type ServiceKey,
} from "@/lib/workflow"
import type { AdditionalRequirementOption } from "@/lib/additional-requirements-shared"
import type {
  ChecklistItem,
  Client,
  Project,
  ProjectAdditionalRequirement,
} from "@/lib/types"

const SERVICE_ALIASES: Record<string, ServiceKey> = {
  architectural_plan: "architecture_design",
}

function resolveServiceKeys(
  keys: readonly string[],
  catalog: readonly ProjectServiceDef[],
): ServiceKey[] {
  const valid = new Set(catalog.map((s) => s.key))
  const resolved: ServiceKey[] = []
  for (const key of keys) {
    const mapped = SERVICE_ALIASES[key] ?? key
    if (!valid.has(mapped)) continue
    if (!resolved.includes(mapped)) resolved.push(mapped)
  }
  return resolved
}

const TYPE_OPTIONS = PROJECT_TYPES.map((t) => ({ value: t, label: t }))
const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: p }))

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function resolveTypeState(type: string | null | undefined): {
  projectType: string
  customType: string
} {
  if (!type) return { projectType: "Residential", customType: "" }
  if ((PROJECT_TYPES as readonly string[]).includes(type)) {
    return { projectType: type, customType: "" }
  }
  return { projectType: "Other", customType: type }
}

function mergeFieldOptions(
  catalog: AdditionalRequirementOption[],
  saved: ProjectAdditionalRequirement[],
): AdditionalRequirementOption[] {
  const byKey = new Map(catalog.map((option) => [option.value, option]))
  for (const field of saved) {
    if (byKey.has(field.requirement_key)) continue
    byKey.set(field.requirement_key, {
      value: field.requirement_key,
      label: field.label,
      valueType: field.value_type,
      choiceOptions: field.choice_options,
    })
  }
  return [...byKey.values()]
}

export function ProjectEditDialog({
  project,
  clients,
  services,
  documentTemplates = [],
  additionalRequirementOptions = [],
  additionalRequirements = [],
  selectedServiceKeys = [],
  checklist = [],
  canSetStartDate = false,
}: {
  project: Project
  clients: Client[]
  services: ProjectServiceDef[]
  documentTemplates?: DocumentTemplateOption[]
  additionalRequirementOptions?: AdditionalRequirementOption[]
  additionalRequirements?: ProjectAdditionalRequirement[]
  selectedServiceKeys?: string[]
  checklist?: ChecklistItem[]
  canSetStartDate?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectType, setProjectType] = useState(() => resolveTypeState(project.type).projectType)
  const [customType, setCustomType] = useState(() => resolveTypeState(project.type).customType)
  const [projectPackage, setProjectPackage] = useState<"full" | "custom">(() =>
    project.project_package === "custom" ? "custom" : "full",
  )
  const [selectedServices, setSelectedServices] = useState<string[]>(() =>
    project.project_package === "custom" ? selectedServiceKeys : [],
  )
  const [pending, startTransition] = useTransition()

  const fieldId = `project-edit-${project.id}`
  const isOtherType = projectType === "Other"
  const isResidential = showsResidentialDetails(projectType)
  const showPropertyFields =
    isResidential &&
    (projectPackage === "full" ||
      showsResidentialPropertyFields(
        selectedServices.filter((key): key is ResidentialServiceKey =>
          RESIDENTIAL_SERVICE_TYPES.some((service) => service.key === key),
        ),
      ))

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: String(c.id),
        label: c.phone ? `${c.name} — ${c.phone}` : c.name,
      })),
    [clients],
  )

  const serviceOptions = useMemo(() => {
    const core = services.map((s) => ({ value: s.key, label: s.label }))
    if (!isResidential) return core

    const residential = RESIDENTIAL_SERVICE_TYPES.map((s) => ({
      value: s.key as string,
      label: s.label,
    }))
    const residentialKeys = new Set<string>(residential.map((s) => s.value))
    return [...residential, ...core.filter((s) => !residentialKeys.has(s.value))]
  }, [isResidential, services])

  const activeServiceKeys = useMemo(() => {
    if (projectPackage === "full") return services.map((s) => s.key)
    return resolveServiceKeys(selectedServices, services)
  }, [projectPackage, selectedServices, services])

  const documentOptions = useMemo(() => {
    const selected = new Set(activeServiceKeys)
    return documentTemplates
      .filter((item) => selected.has(item.serviceKey))
      .map((item) => ({
        value: item.itemKey,
        label: item.label,
        description: serviceByKey(item.serviceKey, services)?.label ?? item.serviceKey,
      }))
  }, [activeServiceKeys, documentTemplates, services])

  const documentSelectKey = useMemo(
    () => `${projectPackage}:${activeServiceKeys.join(",")}`,
    [projectPackage, activeServiceKeys],
  )

  const selectedDocumentKeys = useMemo(
    () => checklist.map((item) => item.item_key),
    [checklist],
  )

  const customFieldOptions = useMemo(
    () => mergeFieldOptions(additionalRequirementOptions, additionalRequirements),
    [additionalRequirementOptions, additionalRequirements],
  )
  const customFieldSelected = useMemo(
    () => additionalRequirements.map((field) => field.requirement_key),
    [additionalRequirements],
  )
  const customFieldValues = useMemo(
    () => Object.fromEntries(additionalRequirements.map((field) => [field.requirement_key, field.value])),
    [additionalRequirements],
  )

  useEffect(() => {
    if (!open) return
    const resolved = resolveTypeState(project.type)
    setProjectType(resolved.projectType)
    setCustomType(resolved.customType)
    const isCustom = project.project_package === "custom"
    setProjectPackage(isCustom ? "custom" : "full")
    setSelectedServices(isCustom ? selectedServiceKeys : [])
    setError(null)
  }, [open, project, selectedServiceKeys])

  function onSubmit(formData: FormData) {
    setError(null)
    if (isOtherType) {
      const custom = customType.trim()
      if (!custom) {
        setError("Please enter a custom project type.")
        return
      }
      formData.set("type", custom)
    }
    formData.set("project_package", projectPackage)

    startTransition(async () => {
      const res = await updateProjectDetails(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Project details updated")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" /> Edit details
          </Button>
        }
      />
      <FormDialogShell
        title="Edit Project Details"
        description="Update all project fields, including package, services, and workflow documents."
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="id" value={project.id} />

            <FormDialogBody>
              <div className="flex flex-col gap-5">
                <FormSection title="Project Details">
                  <div className="flex flex-col gap-3">
                    <FormField label="Project name" htmlFor={`${fieldId}-name`}>
                      <Input
                        id={`${fieldId}-name`}
                        name="name"
                        defaultValue={project.name}
                        required
                        className={formControlClass}
                      />
                    </FormField>

                    <FormField label="Refer name" htmlFor={`${fieldId}-refer`}>
                      <Input
                        id={`${fieldId}-refer`}
                        name="refer_name"
                        defaultValue={project.refer_name ?? ""}
                        placeholder="Who referred this project"
                        className={formControlClass}
                      />
                    </FormField>

                    <FormField label="MBook Number" htmlFor={`${fieldId}-edgebook`}>
                      <Input
                        id={`${fieldId}-edgebook`}
                        name="edgebook_number"
                        defaultValue={project.edgebook_number ?? ""}
                        placeholder="e.g. MB-2024-001"
                        className={formControlClass}
                      />
                    </FormField>

                    <FormField label="Client" htmlFor={`${fieldId}-client`}>
                      <FormSelect
                        id={`${fieldId}-client`}
                        name="client_id"
                        required
                        defaultValue={String(project.client_id)}
                        placeholder="Select a client"
                        options={clientOptions}
                        className={formControlClass}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Location" htmlFor={`${fieldId}-location`}>
                        <Input
                          id={`${fieldId}-location`}
                          name="location"
                          defaultValue={project.location ?? ""}
                          placeholder="City, State"
                          className={formControlClass}
                        />
                      </FormField>
                      <FormField label="Type" htmlFor={`${fieldId}-type`}>
                        <FormSelect
                          id={`${fieldId}-type`}
                          name="type"
                          value={projectType}
                          onValueChange={(value) => {
                            const next = value ?? "Residential"
                            setProjectType(next)
                            if (next !== "Other") setCustomType("")
                          }}
                          options={TYPE_OPTIONS}
                          className={formControlClass}
                        />
                      </FormField>
                    </div>

                    <AnimatePresence initial={false}>
                      {isOtherType ? (
                        <motion.div
                          key="custom-project-type"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                          className="overflow-hidden"
                        >
                          <FormField label="Custom type" htmlFor={`${fieldId}-custom-type`}>
                            <Input
                              id={`${fieldId}-custom-type`}
                              name="custom_type"
                              value={customType}
                              onChange={(e) => setCustomType(e.target.value)}
                              placeholder="Enter project type"
                              required
                              className={formControlClass}
                            />
                          </FormField>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <DrawingNumberField
                      idPrefix={`${fieldId}-`}
                      defaultValue={project.drawing_number ?? ""}
                    />
                  </div>
                </FormSection>

                <FormSection title="Project Package">
                  <div className="flex flex-col gap-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="project_package_ui"
                        checked={projectPackage === "full"}
                        onChange={() => {
                          setProjectPackage("full")
                          setSelectedServices([])
                        }}
                        className="size-4 accent-primary"
                      />
                      <span className="text-sm">Full Project — all core services</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="project_package_ui"
                        checked={projectPackage === "custom"}
                        onChange={() => {
                          setProjectPackage("custom")
                          setSelectedServices((current) =>
                            current.length ? current : selectedServiceKeys,
                          )
                        }}
                        className="size-4 accent-primary"
                      />
                      <span className="text-sm">
                        Custom Services — pick only what the client needs
                      </span>
                    </label>
                  </div>

                  {projectPackage === "custom" ? (
                    <div className="mt-3 flex flex-col gap-3">
                      <FormField label="Project services">
                        <FormMultiSelect
                          key={isResidential ? "custom-services-residential" : "custom-services"}
                          name="services"
                          required
                          placeholder="Select services..."
                          searchPlaceholder="Search services..."
                          options={serviceOptions}
                          defaultSelected={
                            selectedServices.length ? selectedServices : selectedServiceKeys
                          }
                          showAvatars={false}
                          onSelectedChange={setSelectedServices}
                        />
                      </FormField>
                      <p className="text-xs text-muted-foreground">
                        New services are added to the workflow. A service with progress cannot be
                        removed.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Full package keeps every core service on the workflow timeline.
                    </p>
                  )}

                  <AnimatePresence initial={false}>
                    {showPropertyFields ? (
                      <motion.div
                        key="residential-property-fields"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3">
                          <ResidentialPropertyFields
                            idPrefix={`${fieldId}-`}
                            defaultBuildingNumber={project.building_number ?? ""}
                            defaultBuildingPermitNumber={project.building_permit_number ?? ""}
                          />
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </FormSection>

                {documentOptions.length > 0 ? (
                  <FormSection title="Documents">
                    <FormField label="Required documents">
                      <FormMultiSelect
                        key={documentSelectKey}
                        name="documents"
                        placeholder="Select documents for this project..."
                        searchPlaceholder="Search documents..."
                        options={documentOptions}
                        defaultSelected={selectedDocumentKeys}
                        showAvatars={false}
                      />
                    </FormField>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Documents are added to the project checklist. Checked or filed documents are
                      kept even if you unselect them.
                    </p>
                  </FormSection>
                ) : projectPackage === "custom" ? (
                  <FormSection title="Documents">
                    <p className="text-sm text-muted-foreground">
                      Select services above to choose the documents required for this project.
                    </p>
                  </FormSection>
                ) : null}

                {customFieldOptions.length > 0 ? (
                  <>
                    <input type="hidden" name="edit_custom_fields" value="1" />
                    <AdditionalRequirementsFields
                      idPrefix={`${fieldId}-`}
                      options={customFieldOptions}
                      defaultSelected={customFieldSelected}
                      defaultValues={customFieldValues}
                    />
                  </>
                ) : null}

                <FormSection title="Timeline & Budget">
                  <div
                    className={
                      canSetStartDate
                        ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
                        : "grid grid-cols-1 gap-3 sm:grid-cols-3"
                    }
                  >
                    <FormField label="Priority" htmlFor={`${fieldId}-priority`}>
                      <FormSelect
                        id={`${fieldId}-priority`}
                        name="priority"
                        defaultValue={project.priority || "Medium"}
                        options={PRIORITY_OPTIONS}
                        className={formControlClass}
                      />
                    </FormField>
                    {canSetStartDate ? (
                      <ProjectStartDateField
                        id={`${fieldId}-start`}
                        defaultValue={localDateInputValue(project.created_at)}
                      />
                    ) : null}
                    <FormField label="Due date" htmlFor={`${fieldId}-due`}>
                      <Input
                        id={`${fieldId}-due`}
                        name="due_date"
                        type="date"
                        defaultValue={toDateInputValue(project.due_date)}
                        className={formControlClass}
                      />
                    </FormField>
                    <FormField label="Amount (₹)" htmlFor={`${fieldId}-amount`}>
                      <Input
                        id={`${fieldId}-amount`}
                        name="project_amount"
                        type="number"
                        min="0"
                        step="1000"
                        defaultValue={Number(project.project_amount) || 0}
                        className={formControlClass}
                      />
                    </FormField>
                  </div>
                </FormSection>

                <ProjectNotesField
                  id={`${fieldId}-notes`}
                  defaultValue={project.notes ?? ""}
                />

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            </FormDialogBody>

            <FormDialogFooter
              submitLabel={pending ? "Saving..." : "Save changes"}
              pending={pending}
            />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
