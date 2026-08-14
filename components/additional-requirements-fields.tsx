"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CustomFieldValueInput } from "@/components/custom-field-value-input"
import { FormMultiSelect } from "@/components/form-multi-select"
import { FormField, FormSection } from "@/components/form-section"
import type { AdditionalRequirementOption } from "@/lib/additional-requirements-shared"

type AdditionalRequirementsFieldsProps = {
  options: AdditionalRequirementOption[]
  idPrefix?: string
  defaultSelected?: string[]
  defaultValues?: Record<string, string>
  /** Compact picker + value inputs, without the create-form section wrapper. */
  embedded?: boolean
}

export function AdditionalRequirementsFields({
  options,
  idPrefix = "",
  defaultSelected = [],
  defaultValues = {},
  embedded = false,
}: AdditionalRequirementsFieldsProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(defaultSelected)

  const selectedOptions = useMemo(
    () => options.filter((option) => selectedKeys.includes(option.value)),
    [options, selectedKeys],
  )

  if (!options.length) return null

  const fields = (
    <>
      <FormField label={embedded ? "Add fields" : "Custom fields"}>
        <FormMultiSelect
          name="additional_requirements"
          placeholder="Select fields..."
          searchPlaceholder="Search fields..."
          emptyMessage="No fields match your search."
          options={options}
          defaultSelected={defaultSelected}
          showAvatars={false}
          onSelectedChange={setSelectedKeys}
        />
      </FormField>

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
          ? "Select a field to add it, then enter its value and save."
          : "Selected fields appear on the project details page and print form."}
      </p>
    </>
  )

  if (embedded) return <div className="flex flex-col gap-3">{fields}</div>

  return <FormSection title="Custom Fields">{fields}</FormSection>
}
