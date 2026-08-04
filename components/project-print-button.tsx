"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiUrl } from "@/lib/app-urls"
import { cn } from "@/lib/utils"

interface ProjectPrintButtonProps {
  projectId: number
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "default" | "sm" | "icon" | "icon-sm"
  className?: string
  label?: string
}

export function projectPrintUrl(projectId: number): string {
  return apiUrl(`/api/admin/projects/${projectId}/pdf`)
}

export function openProjectPrint(projectId: number) {
  const url = projectPrintUrl(projectId)
  const w = window.open(url, "_blank")
  w?.addEventListener("load", () => w.print())
}

export function ProjectPrintButton({
  projectId,
  variant = "outline",
  size = "sm",
  className,
  label = "Print",
}: ProjectPrintButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={() => openProjectPrint(projectId)}
      title="Print project & client details"
    >
      <Printer className="size-4" />
      {size === "icon" || size === "icon-sm" ? null : label}
    </Button>
  )
}
