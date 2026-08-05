"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { FormField, formControlClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveAttendanceSettingsAction } from "@/lib/attendance/actions"
import type { AttendanceSettings } from "@/lib/attendance/types"

export function AttendanceSettingsForm({ settings }: { settings: AttendanceSettings }) {
  const [pending, startTransition] = useTransition()

  function onSave(formData: FormData) {
    startTransition(async () => {
      const res = await saveAttendanceSettingsAction(formData)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Attendance settings saved")
    })
  }

  return (
    <form action={onSave} className="rounded-xl border border-border/60 bg-card p-5 shadow-premium print:hidden">
      <h3 className="text-sm font-semibold">Office Timing</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Staff check-in after start time + buffer is marked as Late Coming.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Office start time" htmlFor="office_start_time">
          <Input
            id="office_start_time"
            name="office_start_time"
            type="time"
            required
            defaultValue={settings.office_start_time}
            className={formControlClass}
          />
        </FormField>
        <FormField label="Buffer (minutes)" htmlFor="buffer_minutes">
          <Input
            id="buffer_minutes"
            name="buffer_minutes"
            type="number"
            min={0}
            max={180}
            step={1}
            required
            defaultValue={String(settings.buffer_minutes)}
            className={formControlClass}
          />
        </FormField>
        <FormField label="Geofence radius (m)" htmlFor="radius_meters">
          <Input
            id="radius_meters"
            name="radius_meters"
            type="number"
            min={50}
            max={5000}
            step={10}
            required
            defaultValue={String(settings.radius_meters)}
            className={formControlClass}
          />
        </FormField>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            Save timing
          </Button>
        </div>
      </div>

      <input type="hidden" name="latitude" value={String(settings.latitude)} />
      <input type="hidden" name="longitude" value={String(settings.longitude)} />

      <p className="mt-3 text-xs text-muted-foreground">
        Example: start 09:30 + buffer 10 min → check-in after 09:40 = Late Coming.
      </p>
    </form>
  )
}
