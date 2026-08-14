"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormSelect } from "@/components/form-select"
import { FormField, FormSection, formControlClass, formTextareaClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  createAdditionalRequirementTemplate,
  updateAdditionalRequirementTemplate,
} from "@/lib/actions"
import {
  CUSTOM_FIELD_VALUE_TYPES,
  parseCustomFieldValueType,
  type CustomFieldValueType,
} from "@/lib/additional-requirements-shared"
import type { AdditionalRequirementTemplateRow } from "@/lib/types"

const VALUE_TYPE_OPTIONS = CUSTOM_FIELD_VALUE_TYPES.map((item) => ({
  value: item.value,
  label: item.label,
}))

export function RequirementDialog({
  requirement,
}: {
  requirement?: AdditionalRequirementTemplateRow
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(requirement)
  const fieldId = requirement ? `req-${requirement.id}` : "req-new"

  const [label, setLabel] = useState("")
  const [valueType, setValueType] = useState<CustomFieldValueType>("text")
  const [choiceOptions, setChoiceOptions] = useState("")
  const [sortOrder, setSortOrder] = useState("10")
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setLabel(requirement?.label ?? "")
    setValueType(parseCustomFieldValueType(requirement?.value_type))
    setChoiceOptions((requirement?.choice_options ?? []).join("\n"))
    setSortOrder(String(requirement?.sort_order ?? 10))
    setActive(requirement?.active ?? true)
    setError(null)
  }, [open, requirement])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!label.trim()) {
      setError("Field name is required.")
      return
    }
    if (valueType === "choice" && choiceOptions.split(/[\n,]/).filter((item) => item.trim()).length < 2) {
      setError("Add at least two choices, one per line.")
      return
    }

    const formData = new FormData()
    formData.set("label", label.trim())
    formData.set("value_type", valueType)
    formData.set("choice_options", choiceOptions)
    if (isEdit) {
      formData.set("id", String(requirement!.id))
      formData.set("sort_order", sortOrder)
      formData.set("active", active ? "true" : "false")
    }

    startTransition(async () => {
      try {
        const res = isEdit
          ? await updateAdditionalRequirementTemplate(formData)
          : await createAdditionalRequirementTemplate(formData)
        if (res?.error) {
          setError(res.error)
          return
        }
        toast.success(isEdit ? "Custom field updated" : "Custom field added")
        setOpen(false)
        router.refresh()
      } catch (err) {
        console.error("[requirement-dialog] save failed:", err)
        setError("Could not save field. Please try again.")
        toast.error("Could not save field")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> Edit
            </Button>
          ) : (
            <Button>
              <Plus className="size-4" /> Add Field
            </Button>
          )
        }
      />
      <FormDialogShell
        title={isEdit ? "Edit Custom Field" : "Add Custom Field"}
        description={
          isEdit
            ? "Update the name, value type, order, or visibility."
            : "New fields appear when creating a project. Pick a value type so staff enter the right kind of data."
        }
      >
        {open ? (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              <div className="flex flex-col gap-5">
                <FormSection title="Field">
                  <div className="flex flex-col gap-3">
                    <FormField label="Name" htmlFor={`${fieldId}-label`}>
                      <Input
                        id={`${fieldId}-label`}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        required
                        placeholder="e.g. Ward Number"
                        className={formControlClass}
                      />
                    </FormField>

                    <FormField label="Value type" htmlFor={`${fieldId}-type`}>
                      <FormSelect
                        id={`${fieldId}-type`}
                        value={valueType}
                        onValueChange={(value) =>
                          setValueType(parseCustomFieldValueType(value))
                        }
                        options={VALUE_TYPE_OPTIONS}
                        className={formControlClass}
                      />
                    </FormField>

                    {valueType === "choice" ? (
                      <FormField label="Choices" htmlFor={`${fieldId}-choices`}>
                        <Textarea
                          id={`${fieldId}-choices`}
                          value={choiceOptions}
                          onChange={(e) => setChoiceOptions(e.target.value)}
                          placeholder={"Residential\nCommercial\nMixed"}
                          className={formTextareaClass}
                        />
                        <p className="text-xs text-muted-foreground">
                          One option per line. Shown as radio buttons on the project form.
                        </p>
                      </FormField>
                    ) : null}

                    {isEdit ? (
                      <FormField label="Sort order" htmlFor={`${fieldId}-sort`}>
                        <Input
                          id={`${fieldId}-sort`}
                          type="number"
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value)}
                          className={formControlClass}
                        />
                        <p className="text-xs text-muted-foreground">
                          Lower numbers appear earlier in lists.
                        </p>
                      </FormField>
                    ) : null}

                    {isEdit ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={active}
                          onCheckedChange={(checked) => setActive(checked === true)}
                        />
                        Active (show when creating projects)
                      </label>
                    ) : null}
                  </div>
                </FormSection>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            </FormDialogBody>

            <FormDialogFooter
              submitLabel={pending ? "Saving..." : isEdit ? "Save Changes" : "Add Field"}
              pending={pending}
              submitDisabled={!label.trim()}
            />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
