"use client"

import { Button } from "@/components/ui/button"

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        This page could not be loaded. Try again, or go back to clients.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={() => window.location.assign("/admin/clients")}>
          Open clients
        </Button>
      </div>
    </div>
  )
}
