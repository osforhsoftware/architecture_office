"use client"

import type { ReactNode } from "react"
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FormDialogShellProps = {
  title: string
  description?: ReactNode
  children: ReactNode
  size?: "md" | "lg"
  className?: string
}

export function FormDialogShell({
  title,
  description,
  children,
  size = "lg",
  className,
}: FormDialogShellProps) {
  return (
    <DialogContent
      className={cn(
        "flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0",
        size === "lg" ? "sm:max-w-lg" : "sm:max-w-md",
        className,
      )}
    >
      <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 py-4 sm:px-6">
        <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="text-xs sm:text-sm">{description}</DialogDescription>
        ) : null}
      </DialogHeader>
      {children}
    </DialogContent>
  )
}

export function FormDialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  )
}

type FormDialogFooterProps = {
  cancelLabel?: string
  submitLabel: string
  pending?: boolean
  submitDisabled?: boolean
  submitVariant?: "default" | "destructive"
  submitType?: "submit" | "button"
  onSubmit?: () => void
  children?: ReactNode
}

export function FormDialogFooter({
  cancelLabel = "Cancel",
  submitLabel,
  pending = false,
  submitDisabled = false,
  submitVariant = "default",
  submitType = "submit",
  onSubmit,
  children,
}: FormDialogFooterProps) {
  return (
    <div className="shrink-0 border-t border-border/60 bg-background/95 px-5 py-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 sm:px-6 sm:py-4">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {children}
        <DialogClose
          render={
            <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" />
          }
        >
          {cancelLabel}
        </DialogClose>
        <Button
          type={submitType}
          variant={submitVariant}
          disabled={submitDisabled || pending}
          onClick={onSubmit}
          className="min-h-11 w-full sm:w-auto"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
