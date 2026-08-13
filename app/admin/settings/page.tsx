import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth"
import { canAccessSystemSettings } from "@/lib/constants"
import { OfficeProfileSettings } from "@/components/office-profile-settings"
import { getOfficeProfile } from "@/lib/queries"

export default async function AdminSettingsPage() {
  const user = await getCurrentUser()
  if (!user || !canAccessSystemSettings(user.role)) redirect("/admin")

  const profile = await getOfficeProfile()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Configuration</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Company profile and system configuration. Acmmo Admin only.
        </p>
      </div>

      <OfficeProfileSettings profile={profile} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
          <h3 className="font-semibold">Workflow Stages</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Customize department pipeline stages
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Coming soon</p>
        </div>
        <Link
          href="/admin/documents"
          className="rounded-xl border border-border/60 bg-card p-5 shadow-premium transition-colors hover:border-primary/40 hover:bg-muted/30"
        >
          <h3 className="font-semibold">Document Templates</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Standard checklist documents per service
          </p>
          <p className="mt-3 text-xs font-medium text-primary">Manage documents →</p>
        </Link>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
          <h3 className="font-semibold">Notifications</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Email and in-app alert preferences
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Coming soon</p>
        </div>
      </div>
    </div>
  )
}
