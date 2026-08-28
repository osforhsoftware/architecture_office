"use client"

import { useMemo, useRef, useTransition } from "react"
import { ListChecks } from "lucide-react"
import { toast } from "sonner"
import { AdditionalRequirementsFields } from "@/components/additional-requirements-fields"
import { useProjectSaveSection } from "@/components/project-details-save"
import { Button } from "@/components/ui/button"
import { updateProjectCustomFields } from "@/lib/actions"
import type { AdditionalRequirementOption } from "@/lib/additional-requirements-shared"
import { formatCustomFieldValue } from "@/lib/additional-requirements-shared"
import type { ProjectAdditionalRequirement } from "@/lib/types"

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

function EmptyCustomFields({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
      <ListChecks className="mx-auto size-8 text-muted-foreground/50" />
      <p className="mt-3 text-sm font-medium">No custom fields for this project</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

export function AdditionalRequirementsSection({
  projectId,
  requirements,
  options = [],
  readOnly = false,
}: {
  projectId: number
  requirements: ProjectAdditionalRequirement[]
  options?: AdditionalRequirementOption[]
  readOnly?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const { grouped, pending: groupedPending } = useProjectSaveSection("custom-fields", () => {
    const fd = formRef.current ? new FormData(formRef.current) : new FormData()
    if (formRef.current) fd.set("save_custom_fields", "1")
    return fd
  })
  const saving = grouped ? groupedPending : pending

  const fieldOptions = useMemo(
    () => mergeFieldOptions(options, requirements),
    [options, requirements],
  )
  const defaultSelected = useMemo(
    () => requirements.map((field) => field.requirement_key),
    [requirements],
  )
  const defaultValues = useMemo(
    () =>
      Object.fromEntries(requirements.map((field) => [field.requirement_key, field.value])),
    [requirements],
  )

  if (readOnly) {
    if (!requirements.length) {
      return (
        <EmptyCustomFields message="Custom fields are chosen when the project is created or edited." />
      )
    }
    return (
      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Field
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((field) => (
              <tr
                key={field.requirement_key}
                className="border-b border-border/40 last:border-b-0"
              >
                <td className="px-3 py-2.5 font-medium text-foreground">{field.label}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {formatCustomFieldValue(field.value, field.value_type) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!fieldOptions.length) {
    return (
      <EmptyCustomFields message="Define custom fields in Settings, then select them here to enter values." />
    )
  }

  function onSave(formData: FormData) {
    formData.set("project_id", String(projectId))
    startTransition(async () => {
      const res = await updateProjectCustomFields(formData)
      if (res?.error) toast.error(res.error)
      else toast.success("Custom fields saved")
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {grouped
          ? "Add fields from the list and enter values. Use Update Project to save."
          : "Add fields from the list, enter values, then save."}
      </p>
      <form
        ref={formRef}
        action={grouped ? undefined : onSave}
        onSubmit={grouped ? (event) => event.preventDefault() : undefined}
        className="flex flex-col gap-3"
      >
        <AdditionalRequirementsFields
          key={defaultSelected.join(",")}
          options={fieldOptions}
          defaultSelected={defaultSelected}
          defaultValues={defaultValues}
          idPrefix="details-"
          embedded
        />
        {!grouped ? (
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving..." : "Save fields"}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
