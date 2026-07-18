"use client"

import { useMemo, useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FormSelect } from "@/components/form-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createProject } from "@/lib/actions"
import { PRIORITIES } from "@/lib/constants"
import type { Client } from "@/lib/types"

const PROJECT_TYPES = ["Residential", "Commercial", "Industrial", "Institutional", "Renovation"]

export function ProjectDialog({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: String(c.id),
        label: `${c.name} — ${c.phone}`,
      })),
    [clients],
  )

  const typeOptions = useMemo(
    () => PROJECT_TYPES.map((t) => ({ value: t, label: t })),
    [],
  )

  const priorityOptions = useMemo(
    () => PRIORITIES.map((p) => ({ value: p, label: p })),
    [],
  )

  const serviceOptions = useMemo(() => {
    const core = PROJECT_SERVICES.map((s) => ({ value: s.key, label: s.label }))
    if (!isResidential) return core

    const residential = RESIDENTIAL_SERVICE_TYPES.map((s) => ({
      value: s.key,
      label: s.label,
    }))
    const residentialKeys = new Set<string>(residential.map((s) => s.value))
    return [...residential, ...core.filter((s) => !residentialKeys.has(s.value))]
  }, [isResidential])

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createProject(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Project created")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={clients.length === 0}>
            <Plus className="size-4" /> New Project
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a project and assign it to a client. It will start in the
            Planning &amp; Design section.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" name="name" placeholder="e.g. Hillside Villa" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client_id">Client</Label>
            <FormSelect
              id="client_id"
              name="client_id"
              required
              placeholder="Select a client"
              options={clientOptions}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="City, State" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <FormSelect
                id="type"
                name="type"
                defaultValue="Residential"
                options={typeOptions}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="priority">Priority</Label>
              <FormSelect
                id="priority"
                name="priority"
                defaultValue="Medium"
                options={priorityOptions}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" name="due_date" type="date" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project_amount">Amount (₹)</Label>
              <Input
                id="project_amount"
                name="project_amount"
                type="number"
                min="0"
                step="1000"
                defaultValue="0"
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
