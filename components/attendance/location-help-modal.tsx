"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { LocationPlatform } from "@/lib/attendance/location"
import { cn } from "@/lib/utils"

const ANDROID_STEPS = [
  "Turn on Location from Quick Settings.",
  "Open browser site permissions.",
  "Set Location → Allow.",
  "Return to Attendance.",
  "Tap Check Location.",
]

const IPHONE_STEPS = [
  "Open Settings.",
  "Privacy & Security → Location Services.",
  "Turn Location Services ON.",
  "Allow location access for the browser.",
  "Return to Attendance.",
  "Tap Check Location.",
]

const WINDOWS_STEPS = [
  "Open Windows Settings.",
  "Privacy & security → Location.",
  "Turn Location Services ON.",
  "Allow browser location access.",
  "Return to the website.",
  "Click Check Location.",
]

const CHROME_EDGE_STEPS = [
  "Click the lock/settings icon near the website address.",
  "Open Site permissions.",
  "Set Location → Allow.",
  "Reload the page.",
  "Tap Check Location.",
]

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-2">
          <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

function InstructionBlock({
  title,
  steps,
  highlighted,
}: {
  title: string
  steps: string[]
  highlighted?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlighted ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/20",
      )}
    >
      <p className="text-sm font-medium">
        {title}
        {highlighted ? (
          <span className="ml-2 text-xs font-normal text-primary">Detected</span>
        ) : null}
      </p>
      <StepList steps={steps} />
    </div>
  )
}

export function LocationHelpModal({
  open,
  onOpenChange,
  platform,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: LocationPlatform
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How to Enable Location</DialogTitle>
          <DialogDescription className="text-left">
            Browser location permission and device Location Services must both be
            enabled. This website cannot turn GPS on by itself.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <InstructionBlock
            title="Android"
            steps={ANDROID_STEPS}
            highlighted={platform === "android"}
          />
          <InstructionBlock
            title="iPhone"
            steps={IPHONE_STEPS}
            highlighted={platform === "ios"}
          />
          <InstructionBlock
            title="Windows / Desktop"
            steps={WINDOWS_STEPS}
            highlighted={platform === "windows" || platform === "desktop"}
          />
          <InstructionBlock title="Chrome / Edge site permission" steps={CHROME_EDGE_STEPS} />
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
