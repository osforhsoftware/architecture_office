"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ClipboardPen } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { adminMarkAttendanceAction } from "@/lib/attendance/actions"
import { todayInOfficeTzClient } from "@/lib/attendance/client-utils"
import { ATTENDANCE_STATUSES } from "@/lib/attendance/constants"

const STAFF_NONE = "__none__"

export function AdminMarkAttendanceDialog({
  staffOptions,
}: {
  staffOptions: { id: number; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [staffId, setStaffId] = useState(STAFF_NONE)
  const [status, setStatus] = useState("Present")

  function resetForm() {
    setStaffId(STAFF_NONE)
    setStatus("Present")
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetForm()
  }

  function onSubmit(formData: FormData) {
    if (!staffId || staffId === STAFF_NONE) {
      toast.error("Select a staff member.")
      return
    }
    formData.set("staff_id", staffId)
    formData.set("status", status)

    startTransition(async () => {
      const res = await adminMarkAttendanceAction(formData)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Attendance marked")
      setOpen(false)
      resetForm()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <ClipboardPen />
            Mark Attendance
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Attendance (Manual)</DialogTitle>
          <DialogDescription>
            Use when staff are out of office or cannot use GPS check-in. Location is not required.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label>Staff</Label>
            <Select
              value={staffId}
              onValueChange={(v) => {
                if (v) setStaffId(v)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STAFF_NONE}>Select staff</SelectItem>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="attendance_date">Date</Label>
            <Input
              id="attendance_date"
              name="attendance_date"
              type="date"
              required
              defaultValue={todayInOfficeTzClient()}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTENDANCE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {status !== "Absent" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="check_in">Check In</Label>
                <Input id="check_in" name="check_in" type="time" required defaultValue="09:30" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="check_out">Check Out</Label>
                <Input id="check_out" name="check_out" type="time" />
              </div>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="admin_note">Note (optional)</Label>
            <Textarea
              id="admin_note"
              name="admin_note"
              rows={2}
              placeholder="e.g. Site visit / work from client location"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
