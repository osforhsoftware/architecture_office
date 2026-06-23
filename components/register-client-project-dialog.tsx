"use client"

import { useState, useTransition } from "react"
import { UserPlus } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { registerClientWithProject } from "@/lib/actions"
import { PRIORITIES } from "@/lib/constants"

const PROJECT_TYPES = ["Residential", "Commercial", "Industrial", "Institutional", "Renovation"]

export function RegisterClientProjectDialog() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await registerClientWithProject(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Client and project registered")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <UserPlus className="size-4" /> Register client + project
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register client & project</DialogTitle>
          <DialogDescription>
            Creates a client record and first project with auto-generated IDs.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="reg-name">Client name</Label>
              <Input id="reg-name" name="client_name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-phone">Phone</Label>
              <Input id="reg-phone" name="phone" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input id="reg-email" name="email" type="email" />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="reg-address">Address</Label>
              <Textarea id="reg-address" name="address" />
            </div>
          </div>
          <hr className="border-border" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-project-name">Project name</Label>
            <Input id="reg-project-name" name="project_name" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-location">Project location</Label>
              <Input id="reg-location" name="location" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select name="type" defaultValue="Residential">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Priority</Label>
              <Select name="priority" defaultValue="Medium">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-due">Due date</Label>
              <Input id="reg-due" name="due_date" type="date" />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="reg-amount">Project amount (₹)</Label>
              <Input id="reg-amount" name="project_amount" type="number" min="0" step="1000" defaultValue="0" />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Registering..." : "Register"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
