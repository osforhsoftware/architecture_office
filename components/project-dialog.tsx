"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Plus } from "lucide-react"
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
import { DrawingNumberField } from "@/components/project-drawing-number-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createProject } from "@/lib/actions"
import {
  PRIORITIES,
  PROJECT_TYPES,
  RESIDENTIAL_SERVICE_TYPES,
  showsResidentialDetails,
  showsResidentialPropertyFields,
  type ResidentialServiceKey,
} from "@/lib/constants"
import { PROJECT_SERVICES } from "@/lib/workflow"
import type { Client } from "@/lib/types"

const TYPE_OPTIONS = PROJECT_TYPES.map((t) => ({ value: t, label: t }))
const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: p }))

export function ProjectDialog({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectType, setProjectType] = useState("Residential")
  const [projectPackage, setProjectPackage] = useState<"full" | "custom">("full")
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  const isResidential = showsResidentialDetails(projectType)
  const showPropertyFields =
    isResidential &&
    projectPackage === "custom" &&
    showsResidentialPropertyFields(
      selectedServices.filter((key): key is ResidentialServiceKey =>
        RESIDENTIAL_SERVICE_TYPES.some((service) => service.key === key),
      ),
    )

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: String(c.id),
        label: `${c.name} — ${c.phone}`,
      })),
    [clients],
  )

  const serviceOptions = useMemo(() => {
    const core = PROJECT_SERVICES.map((s) => ({ value: s.key, label: s.label }))
    if (!isResidential) return core

    const residential = RESIDENTIAL_SERVICE_TYPES.map((s) => ({
      value: s.key,
      label: s.label,
    }))
    const residentialKeys = new Set(residential.map((s) => s.value))
    return [...residential, ...core.filter((s) => !residentialKeys.has(s.value))]
  }, [isResidential])

  useEffect(() => {
    if (!open) return
    setProjectType("Residential")
    setProjectPackage("full")
    setSelectedServices([])
    setError(null)
  }, [open])

  function onSubmit(formData: FormData) {
    setError(null)
    formData.set("project_package", projectPackage)
    startTransition(async () => {
      const res = await createProject(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Project created")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={clients.length === 0}>
            <Plus className="size-4" /> New Project
          </Button>
        }
      />
      <FormDialogShell
        title="New Project"
        description="Select a package or custom services to generate the project workflow."
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              <div className="flex flex-col gap-5">
                <FormSection title="Project Details">
                  <div className="flex flex-col gap-3">
                    <FormField label="Project name" htmlFor="project-name">
                      <Input
                        id="project-name"
                        name="name"
                        placeholder="e.g. Hillside Villa"
                        required
                        className={formControlClass}
                      />
                    </FormField>

                    <FormField label="Client" htmlFor="project-client">
                      <FormSelect
                        id="project-client"
                        name="client_id"
                        required
                        placeholder="Select a client"
                        options={clientOptions}
                        className={formControlClass}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Location" htmlFor="project-location">
                        <Input
                          id="project-location"
                          name="location"
                          placeholder="City, State"
                          className={formControlClass}
                        />
                      </FormField>
                      <FormField label="Type" htmlFor="project-type">
                        <FormSelect
                          id="project-type"
                          name="type"
                          value={projectType}
                          onValueChange={(value) => setProjectType(value ?? "Residential")}
                          options={TYPE_OPTIONS}
                          className={formControlClass}
                        />
                      </FormField>
                    </div>

                    <DrawingNumberField idPrefix="project-" />
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
                        onChange={() => setProjectPackage("custom")}
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
                          onSelectedChange={setSelectedServices}
                        />
                      </FormField>
                      <p className="text-xs text-muted-foreground">
                        Only selected services appear in the workflow timeline and staff queues.
                      </p>

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
                            <ResidentialPropertyFields idPrefix="project-" />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  ) : null}
                </FormSection>

                <FormSection title="Timeline & Budget">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FormField label="Priority" htmlFor="project-priority">
                      <FormSelect
                        id="project-priority"
                        name="priority"
                        defaultValue="Medium"
                        options={PRIORITY_OPTIONS}
                        className={formControlClass}
                      />
                    </FormField>
                    <FormField label="Due date" htmlFor="project-due">
                      <Input
                        id="project-due"
                        name="due_date"
                        type="date"
                        className={formControlClass}
                      />
                    </FormField>
                    <FormField label="Amount (₹)" htmlFor="project-amount">
                      <Input
                        id="project-amount"
                        name="project_amount"
                        type="number"
                        min="0"
                        step="1000"
                        defaultValue="0"
                        className={formControlClass}
                      />
                    </FormField>
                  </div>
                </FormSection>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            </FormDialogBody>

            <FormDialogFooter
              submitLabel={pending ? "Creating..." : "Create project"}
              pending={pending}
            />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
