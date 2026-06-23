"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { createStaff, updateStaff } from "@/lib/actions"
import { STAFF_ROLES } from "@/lib/constants"
import type { AppUser } from "@/lib/types"

function getStaffFormValues(staff?: AppUser) {
  return {
    name: staff?.name ?? "",
    username: staff?.username ?? "",
    password: "",
    role: staff?.role ?? "",
    phone: staff?.phone ?? "",
    email: staff?.email ?? "",
    active: staff?.active ?? true,
  }
}

export function StaffDialog({ staff }: { staff?: AppUser }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(() => getStaffFormValues(staff))
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(staff)

  function onSubmit(formData: FormData) {
    setError(null)
    if (form.active) {
      formData.set("active", "true")
    }
    startTransition(async () => {
      const res = isEdit ? await updateStaff(formData) : await createStaff(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Staff updated" : "Staff added")
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setForm(getStaffFormValues(staff))
        if (!next) setError(null)
      }}
    >
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> Edit
            </Button>
          ) : (
            <Button>
              <Plus className="size-4" /> Add Staff
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Staff" : "Add Staff"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update staff account details and access."
              : "Create a new department staff login."}
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="flex flex-col gap-4">
          {isEdit ? <input type="hidden" name="id" value={staff!.id} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="staff-name">Full name</Label>
              <Input
                id="staff-name"
                name="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="staff-username">Username</Label>
              <Input
                id="staff-username"
                name="username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                autoComplete="off"
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staff-password">
              Password{isEdit ? " (optional)" : ""}
            </Label>
            <Input
              id="staff-password"
              name="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
              required={!isEdit}
              placeholder={isEdit ? "Leave blank to keep current" : undefined}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staff-role">Department role</Label>
            <Select
              name="role"
              value={form.role || null}
              onValueChange={(role) => setForm((f) => ({ ...f, role: role ?? "" }))}
              required
            >
              <SelectTrigger id="staff-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="staff-phone">Phone</Label>
              <Input
                id="staff-phone"
                name="phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="staff-active"
              checked={form.active}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, active: checked === true }))
              }
            />
            <Label htmlFor="staff-active" className="cursor-pointer font-normal">
              Active account (can log in and receive assignments)
            </Label>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save changes" : "Add staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
