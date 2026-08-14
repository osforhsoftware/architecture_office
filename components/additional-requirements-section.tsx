"use client"

import { useMemo, useTransition } from "react"
import { toast } from "sonner"
import { AdditionalRequirementsFields } from "@/components/additional-requirements-fields"
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
    if (!requirements.length) return null
    return (
      <div className="mt-5 border-t border-border/60 pt-5">
        <h4 className="text-sm font-semibold">Custom Fields</h4>
        <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
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
      </div>
    )
  }

  if (!fieldOptions.length) return null

  function onSave(formData: FormData) {
    formData.set("project_id", String(projectId))
    startTransition(async () => {
      const res = await updateProjectCustomFields(formData)
      if (res?.error) toast.error(res.error)
      else toast.success("Custom fields saved")
    })
  }

  return (
    <div className="mt-5 border-t border-border/60 pt-5">
      <h4 className="text-sm font-semibold">Custom Fields</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Add fields from the list, enter values, then save.
      </p>
      <form action={onSave} className="mt-3 flex flex-col gap-3">
        <AdditionalRequirementsFields
          key={defaultSelected.join(",")}
          options={fieldOptions}
          defaultSelected={defaultSelected}
          defaultValues={defaultValues}
          idPrefix="details-"
          embedded
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving..." : "Save fields"}
          </Button>
        </div>
      </form>
    </div>
  )
}
