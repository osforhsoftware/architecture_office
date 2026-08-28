"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CustomFieldValueInput } from "@/components/custom-field-value-input"
import { FormMultiSelect } from "@/components/form-multi-select"
import { FormField, FormSection } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import type { AdditionalRequirementOption } from "@/lib/additional-requirements-shared"

type AdditionalRequirementsFieldsProps = {
  options: AdditionalRequirementOption[]
  idPrefix?: string
  defaultSelected?: string[]
  defaultValues?: Record<string, string>
  /** Select every catalog field on first render (new-project create). */
  selectAllByDefault?: boolean
  /** Compact picker + value inputs, without the create-form section wrapper. */
  embedded?: boolean
}

export function AdditionalRequirementsFields({
  options,
  idPrefix = "",
  defaultSelected = [],
  defaultValues = {},
  selectAllByDefault = false,
  embedded = false,
}: AdditionalRequirementsFieldsProps) {
  const allKeys = useMemo(() => options.map((option) => option.value), [options])
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
    selectAllByDefault ? options.map((option) => option.value) : defaultSelected,
  )

  const selectedOptions = useMemo(
    () => options.filter((option) => selectedKeys.includes(option.value)),
    [options, selectedKeys],
  )
  const allSelected = options.length > 0 && selectedKeys.length === options.length

  if (!options.length) return null

  function selectAll() {
    setSelectedKeys(allKeys)
  }

  function clearAll() {
    setSelectedKeys([])
  }

  const selectActions = (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={selectAll}
        disabled={allSelected}
      >
        Select all
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={clearAll}
        disabled={selectedKeys.length === 0}
      >
        Clear
      </Button>
    </div>
  )

  const fields = (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{embedded ? "Add fields" : "Custom fields"}</p>
          {selectActions}
        </div>
        <FormMultiSelect
          name="additional_requirements"
          placeholder="Select fields..."
          searchPlaceholder="Search fields..."
          emptyMessage="No fields match your search."
          options={options}
          value={selectedKeys}
          showAvatars={false}
          showSelectAll
          onSelectedChange={setSelectedKeys}
        />
      </div>

      <AnimatePresence initial={false}>
        {selectedOptions.length > 0 ? (
          <motion.div
            key="custom-field-values"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-col gap-3">
              {selectedOptions.map((option) => (
                <FormField
                  key={option.value}
                  label={option.label}
                  htmlFor={`${idPrefix}${option.value}-value`}
                >
                  <CustomFieldValueInput
                    fieldKey={option.value}
                    id={`${idPrefix}${option.value}-value`}
                    label={option.label}
                    valueType={option.valueType}
                    choiceOptions={option.choiceOptions}
                    defaultValue={defaultValues[option.value] ?? ""}
                  />
                </FormField>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className="mt-2 text-xs text-muted-foreground">
        {embedded
          ? "Select a field to add it, then enter its value."
          : "Selected fields appear on the project details page and print form."}
      </p>
    </>
  )

  if (embedded) return <div className="flex flex-col gap-3">{fields}</div>

  return <FormSection title="Custom Fields">{fields}</FormSection>
}
