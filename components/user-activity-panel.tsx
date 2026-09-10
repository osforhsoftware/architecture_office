"use client"

import { Activity } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { UserActivityEvent } from "@/lib/queries"

export function UserActivityPanel({
  events,
  userName,
}: {
  events: UserActivityEvent[]
  userName: string
}) {
  const workflow = events.filter((e) => e.kind === "assignment" || e.kind === "review")
  const activity = events.filter((e) => e.kind === "status" || e.kind === "return")

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h4 className="text-sm font-semibold">{userName} — Workflow & Activity</h4>
      </div>
      <Tabs defaultValue="activity">
        <TabsList className="mb-3">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="mt-0">
          <ActivityList events={activity} empty="No status or return activity yet." />
        </TabsContent>
        <TabsContent value="workflow" className="mt-0">
          <ActivityList events={workflow} empty="No assignments or reviews yet." />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ActivityList({ events, empty }: { events: UserActivityEvent[]; empty: string }) {
  if (!events.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {events.map((event) => (
        <div key={event.id} className="rounded-lg border border-border/50 bg-card px-3 py-2.5 text-sm">
          <p className="font-medium">{event.title}</p>
          {event.note ? <p className="mt-0.5 text-xs text-muted-foreground">{event.note}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(event.at).toLocaleString("en-IN")}
          </p>
        </div>
      ))}
    </div>
  )
}
