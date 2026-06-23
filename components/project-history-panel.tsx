import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ReturnHistory, StatusHistory } from "@/lib/types"

export function ProjectHistoryPanel({
  statusHistory,
  returnHistory,
}: {
  statusHistory: StatusHistory[]
  returnHistory: ReturnHistory[]
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status history</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {statusHistory.map((h) => (
              <li key={h.id} className="border-l-2 border-primary/30 pl-3">
                <p className="text-sm font-medium">{h.status}</p>
                {h.note ? <p className="text-xs text-muted-foreground">{h.note}</p> : null}
                <p className="text-[11px] text-muted-foreground">
                  {h.created_by ?? "System"} · {new Date(h.created_at).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
            {statusHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history yet.</p>
            ) : null}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Return history</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {returnHistory.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{r.reason}</p>
                {r.notes ? <p className="text-xs text-muted-foreground">{r.notes}</p> : null}
                <p className="text-[11px] text-muted-foreground">
                  {r.created_by ?? "Staff"} · {new Date(r.created_at).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
            {returnHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No returns recorded.</p>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
