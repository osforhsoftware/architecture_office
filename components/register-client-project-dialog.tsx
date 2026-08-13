"use client"

import { useEffect, useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  IdentityPairFields,
  splitIdentityPairs,
  type IdentityPair,
} from "@/components/identity-pair-fields"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormSelect } from "@/components/form-select"
import { FormField, FormSection, formControlClass, formTextareaClass } from "@/components/form-section"
import { ResidentialPropertyFields } from "@/components/residential-details-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DrawingNumberField } from "@/components/project-drawing-number-panel"
import { ProjectNotesField } from "@/components/project-notes-field"
import { ProjectStartDateField } from "@/components/project-start-date-field"
import { openProjectPrint } from "@/components/project-print-button"
import { registerClientWithProject } from "@/lib/actions"
import { KERALA_DISTRICTS, PRIORITIES, PROJECT_TYPES, showsResidentialDetails } from "@/lib/constants"

const DISTRICT_OPTIONS = KERALA_DISTRICTS.map((d) => ({ value: d, label: d }))
const TYPE_OPTIONS = PROJECT_TYPES.map((t) => ({ value: t, label: t }))
const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: p }))

export function RegisterClientProjectDialog({
  canSetStartDate = false,
}: {
  canSetStartDate?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [district, setDistrict] = useState<string | null>(null)
  const [projectType, setProjectType] = useState("Residential")
  const [customType, setCustomType] = useState("")
  const [identityPairs, setIdentityPairs] = useState<IdentityPair[]>([
    { aadhaar: "", linked: "" },
  ])

  const isOtherType = projectType === "Other"
  const isResidential = showsResidentialDetails(projectType)

  useEffect(() => {
    if (!open) return
    setDistrict(null)
    setProjectType("Residential")
    setCustomType("")
    setIdentityPairs([{ aadhaar: "", linked: "" }])
    setError(null)
  }, [open])

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
    const { aadhaarNumbers, linkedNumbers } = splitIdentityPairs(identityPairs)
    formData.set("aadhaar_numbers", JSON.stringify(aadhaarNumbers))
    formData.set("linked_numbers", JSON.stringify(linkedNumbers))
    startTransition(async () => {
      const res = await registerClientWithProject(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Client and project registered")
      setOpen(false)
      if (res?.projectId) {
        openProjectPrint(res.projectId)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <UserPlus className="size-4" /> Register client + project
          </Button>
        }
      />
      <FormDialogShell
        title="Register Client & Project"
        description="Creates a client record and first project with auto-generated IDs."
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              <div className="flex flex-col gap-5">
                <FormSection title="Client Information">
                  <div className="flex flex-col gap-3">
                    <FormField label="Client name" htmlFor="reg-name">
                      <Input
                        id="reg-name"
                        name="client_name"
                        required
                        className={formControlClass}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Phone" htmlFor="reg-phone">
                        <Input
                          id="reg-phone"
                          name="phone"
                          className={formControlClass}
                        />
                      </FormField>
                      <FormField label="Email" htmlFor="reg-email">
                        <Input
                          id="reg-email"
                          name="email"
                          type="email"
                          className={formControlClass}
                        />
                      </FormField>
                    </div>

                    <FormField label="Address" htmlFor="reg-address">
                      <Textarea
                        id="reg-address"
                        name="address"
                        className={formTextareaClass}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Street" htmlFor="reg-street">
                        <Input id="reg-street" name="street" className={formControlClass} />
                      </FormField>
                      <FormField label="District" htmlFor="reg-district">
                        <FormSelect
                          id="reg-district"
                          name="district"
                          placeholder="Select district"
                          options={DISTRICT_OPTIONS}
                          value={district}
                          onValueChange={setDistrict}
                          className={formControlClass}
                        />
                      </FormField>
                    </div>

                    <IdentityPairFields values={identityPairs} onChange={setIdentityPairs} />
                  </div>
                </FormSection>

                <FormSection title="Project Information">
                  <div className="flex flex-col gap-3">
                    <FormField label="Project name" htmlFor="reg-project-name">
                      <Input
                        id="reg-project-name"
                        name="project_name"
                        required
                        className={formControlClass}
                      />
                    </FormField>

                    <FormField label="Refer name" htmlFor="reg-refer-name">
                      <Input
                        id="reg-refer-name"
                        name="refer_name"
                        placeholder="Who referred this project"
                        className={formControlClass}
                      />
                    </FormField>

                    <FormField label="MBook Number" htmlFor="reg-edgebook-number">
                      <Input
                        id="reg-edgebook-number"
                        name="edgebook_number"
                        placeholder="e.g. MB-2024-001"
                        className={formControlClass}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Location" htmlFor="reg-location">
                        <Input
                          id="reg-location"
                          name="location"
                          placeholder="City, State"
                          className={formControlClass}
                        />
                      </FormField>
                      <FormField label="Project type" htmlFor="reg-type">
                        <FormSelect
                          id="reg-type"
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
                          <FormField label="Custom type" htmlFor="reg-custom-type">
                            <Input
                              id="reg-custom-type"
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

                    <DrawingNumberField idPrefix="reg-" />

                    <AnimatePresence initial={false}>
                      {isResidential ? (
                        <motion.div
                          key="residential-property-fields"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                          className="overflow-hidden"
                        >
                          <ResidentialPropertyFields idPrefix="reg-" />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </FormSection>

                <FormSection title="Timeline & Budget">
                  <div
                    className={
                      canSetStartDate
                        ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
                        : "grid grid-cols-1 gap-3 sm:grid-cols-3"
                    }
                  >
                    <FormField label="Priority" htmlFor="reg-priority">
                      <FormSelect
                        id="reg-priority"
                        name="priority"
                        defaultValue="Medium"
                        options={PRIORITY_OPTIONS}
                        className={formControlClass}
                      />
                    </FormField>
                    {canSetStartDate ? (
                      <ProjectStartDateField id="reg-start" />
                    ) : null}
                    <FormField label="Due date" htmlFor="reg-due">
                      <Input
                        id="reg-due"
                        name="due_date"
                        type="date"
                        className={formControlClass}
                      />
                    </FormField>
                    <FormField label="Budget (₹)" htmlFor="reg-amount">
                      <Input
                        id="reg-amount"
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

                <ProjectNotesField id="reg-notes" />

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            </FormDialogBody>

            <FormDialogFooter
              submitLabel={pending ? "Registering..." : "Register"}
              pending={pending}
            />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
