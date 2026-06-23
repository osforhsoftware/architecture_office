import { OfficeProfileSettings } from "@/components/office-profile-settings"
import { getOfficeProfile } from "@/lib/queries"

export default async function AdminSettingsPage() {
  const profile = await getOfficeProfile()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Configuration</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Office preferences and system configuration.
        </p>
      </div>

      <OfficeProfileSettings profile={profile} />

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: "Workflow Stages", desc: "Customize department pipeline stages" },
          { title: "Document Templates", desc: "Standard checklist and file categories" },
          { title: "Notifications", desc: "Email and in-app alert preferences" },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-border/60 bg-card p-5 shadow-premium"
          >
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
            <p className="mt-3 text-xs text-muted-foreground">Coming soon</p>
          </div>
        ))}
      </div>
    </div>
  )
}
