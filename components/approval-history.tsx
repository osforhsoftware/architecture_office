"use client"

import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react"
import type { WorkflowReviewRow } from "@/lib/workflow-db"

export function ApprovalHistory({ reviews }: { reviews: WorkflowReviewRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Approval History</h3>
      </div>
      <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
        {reviews.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          reviews.map((review) => {
            const approved = review.decision === "approved"
            return (
              <div
                key={review.id}
                className="rounded-lg border border-border/60 bg-card p-3 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  {approved ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">
                      {approved ? "Approved" : "Rejected"} — {review.step_label}
                    </p>
                    {review.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">{review.note}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {review.reviewer_name ?? "System"} ·{" "}
                      {new Date(review.created_at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
