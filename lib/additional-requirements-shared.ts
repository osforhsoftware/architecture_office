export const CUSTOM_FIELD_VALUE_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes / No" },
  { value: "choice", label: "Choice (radio)" },
] as const

export type CustomFieldValueType = (typeof CUSTOM_FIELD_VALUE_TYPES)[number]["value"]

export type AdditionalRequirementOption = {
  value: string
  label: string
  valueType: CustomFieldValueType
  choiceOptions: string[]
}

export function additionalRequirementValueFieldName(requirementKey: string): string {
  return `additional_requirement_value_${requirementKey}`
}

export function parseCustomFieldValueType(value: unknown): CustomFieldValueType {
  const raw = String(value || "text")
  return CUSTOM_FIELD_VALUE_TYPES.some((item) => item.value === raw)
    ? (raw as CustomFieldValueType)
    : "text"
}

export function parseChoiceOptions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item, index, all) => item && all.indexOf(item) === index)
  }
  if (typeof value !== "string" || !value.trim()) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) return parseChoiceOptions(parsed)
  } catch {
    /* plain text */
  }
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item, index, all) => item && all.indexOf(item) === index)
}

export function customFieldTypeLabel(valueType: CustomFieldValueType): string {
  return CUSTOM_FIELD_VALUE_TYPES.find((item) => item.value === valueType)?.label ?? "Text"
}

export function formatCustomFieldValue(
  value: string,
  valueType: CustomFieldValueType = "text",
): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (valueType === "date" && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-")
    return `${day}/${month}/${year}`
  }
  return trimmed
}
