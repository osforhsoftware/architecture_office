import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FormSectionProps = {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

type FormFieldProps = {
  label: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}

export function FormField({ label, htmlFor, children, className }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}

export const formControlClass =
  "h-11 min-h-11 w-full rounded-[10px] data-[size=default]:h-11 focus-visible:ring-2 focus-visible:ring-primary/20"

export const formTextareaClass =
  "min-h-[88px] w-full rounded-[10px] px-3 py-2.5 focus-visible:ring-2 focus-visible:ring-primary/20"
