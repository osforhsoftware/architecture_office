"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { formControlClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  RESIDENTIAL_SERVICE_SELECTION_MODE,
  RESIDENTIAL_SERVICE_TYPES,
  showsResidentialDetails,
  showsResidentialPropertyFields,
  type ResidentialServiceKey,
} from "@/lib/constants"
import { cn } from "@/lib/utils"

export const RESIDENTIAL_REQUIREMENTS = RESIDENTIAL_SERVICE_TYPES.map((service) => ({
  key: service.key,
  label: service.label,
  name: service.fieldName,
}))

export type ResidentialRequirements = Partial<Record<ResidentialServiceKey, boolean>>

function requirementsToServices(requirements: ResidentialRequirements = {}): ResidentialServiceKey[] {
  return RESIDENTIAL_SERVICE_TYPES.filter((service) => requirements[service.key]).map(
    (service) => service.key,
  )
}

type ResidentialPropertyFieldsProps = {
  idPrefix?: string
  defaultBuildingNumber?: string
  defaultBuildingPermitNumber?: string
  className?: string
}

export function ResidentialPropertyFields({
  idPrefix = "",
  defaultBuildingNumber = "",
  defaultBuildingPermitNumber = "",
  className,
}: ResidentialPropertyFieldsProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}building_number`} className="text-sm font-medium">
          Building Number
        </Label>
        <Input
          id={`${idPrefix}building_number`}
          name="building_number"
          placeholder="e.g. 42/A"
          defaultValue={defaultBuildingNumber}
          className={formControlClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}building_permit_number`} className="text-sm font-medium">
          Building Permit Number
        </Label>
        <Input
          id={`${idPrefix}building_permit_number`}
          name="building_permit_number"
          placeholder="e.g. BP-2024-001"
          defaultValue={defaultBuildingPermitNumber}
          className={formControlClass}
        />
      </div>
    </div>
  )
}

type ResidentialServiceTypeSelectProps = {
  idPrefix?: string
  defaultRequirements?: ResidentialRequirements
  className?: string
  onSelectionChange?: (services: ResidentialServiceKey[]) => void
}

export function ResidentialServiceTypeSelect({
  idPrefix = "",
  defaultRequirements = {},
  className,
  onSelectionChange,
}: ResidentialServiceTypeSelectProps) {
  const mode = RESIDENTIAL_SERVICE_SELECTION_MODE
  const [selected, setSelected] = useState<ResidentialServiceKey[]>(() =>
    requirementsToServices(defaultRequirements),
  )

  useEffect(() => {
    setSelected(requirementsToServices(defaultRequirements))
  }, [
    defaultRequirements.architectural_plan,
    defaultRequirements.building_permit,
    defaultRequirements.regularization,
  ])

  useEffect(() => {
    onSelectionChange?.(selected)
  }, [onSelectionChange, selected])

  const selectedLabels = useMemo(
    () =>
      RESIDENTIAL_SERVICE_TYPES.filter((service) => selected.includes(service.key)).map(
        (service) => service.label,
      ),
    [selected],
  )

  function updateSelection(next: ResidentialServiceKey[]) {
    setSelected(next)
    onSelectionChange?.(next)
  }

  function toggleService(key: ResidentialServiceKey) {
    if (mode === "single") {
      updateSelection([key])
      return
    }
    updateSelection(
      selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key],
    )
  }

  const triggerLabel =
    selectedLabels.length === 0
      ? "Select service type"
      : mode === "single"
        ? selectedLabels[0]
        : selectedLabels.join(", ")

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label
        id={`${idPrefix}service-type-label`}
        className="text-sm font-medium"
      >
        Service type
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-labelledby={`${idPrefix}service-type-label`}
              className={cn(
                formControlClass,
                "justify-between px-3 font-normal hover:bg-background",
                selected.length === 0 && "text-muted-foreground",
              )}
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-(--anchor-width) min-w-[var(--anchor-width)]">
          {mode === "single" ? (
            <DropdownMenuRadioGroup
              value={selected[0] ?? ""}
              onValueChange={(value) => updateSelection(value ? [value as ResidentialServiceKey] : [])}
            >
              <DropdownMenuLabel>Choose one service</DropdownMenuLabel>
              {RESIDENTIAL_SERVICE_TYPES.map((service) => (
                <DropdownMenuRadioItem key={service.key} value={service.key}>
                  {service.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          ) : (
            <DropdownMenuGroup>
              <DropdownMenuLabel>Choose one or more services</DropdownMenuLabel>
              {RESIDENTIAL_SERVICE_TYPES.map((service) => (
                <DropdownMenuCheckboxItem
                  key={service.key}
                  checked={selected.includes(service.key)}
                  onCheckedChange={() => toggleService(service.key)}
                >
                  {service.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {RESIDENTIAL_SERVICE_TYPES.map((service) =>
        selected.includes(service.key) ? (
          <input key={service.key} type="hidden" name={service.fieldName} value="true" />
        ) : null,
      )}
    </div>
  )
}

type ResidentialProjectFieldsProps = {
  idPrefix?: string
  defaultBuildingNumber?: string
  defaultBuildingPermitNumber?: string
  defaultRequirements?: ResidentialRequirements
  className?: string
}

/** Service type dropdown plus conditional building fields for residential projects. */
export function ResidentialProjectFields({
  idPrefix = "",
  defaultBuildingNumber = "",
  defaultBuildingPermitNumber = "",
  defaultRequirements = {},
  className,
}: ResidentialProjectFieldsProps) {
  const [selectedServices, setSelectedServices] = useState<ResidentialServiceKey[]>(() =>
    requirementsToServices(defaultRequirements),
  )
  const showPropertyFields = showsResidentialPropertyFields(selectedServices)

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ResidentialServiceTypeSelect
        idPrefix={idPrefix}
        defaultRequirements={defaultRequirements}
        onSelectionChange={setSelectedServices}
      />
      <AnimatePresence initial={false}>
        {showPropertyFields ? (
          <motion.div
            key="residential-property-fields"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <ResidentialPropertyFields
              idPrefix={idPrefix}
              defaultBuildingNumber={defaultBuildingNumber}
              defaultBuildingPermitNumber={defaultBuildingPermitNumber}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

type ResidentialDetailsSectionProps = ResidentialProjectFieldsProps & {
  projectType: string | null | undefined
}

export function ResidentialDetailsSection({
  projectType,
  ...props
}: ResidentialDetailsSectionProps) {
  if (!showsResidentialDetails(projectType)) return null
  return <ResidentialProjectFields {...props} />
}

/** @deprecated Use ResidentialServiceTypeSelect instead. */
export function ResidentialRequirementChips(props: ResidentialServiceTypeSelectProps) {
  return <ResidentialServiceTypeSelect {...props} />
}
