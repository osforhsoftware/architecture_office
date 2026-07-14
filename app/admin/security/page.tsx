import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { canAccessSystemSettings, ALL_ROLES, ROLE_KEYS, roleToKey } from "@/lib/constants"

export default async function SecuritySettingsPage() {
  const user = await getCurrentUser()
  if (!user || !canAccessSystemSettings(user.role)) redirect("/admin")

  const cookieSecure = process.env.COOKIE_SECURE?.trim() || "(auto)"
  const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || "(not set)"
  const frontendUrl = process.env.FRONTEND_URL?.trim() || "(relative / local)"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Security</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Security Settings</h2>
        <p className="text-sm text-muted-foreground">
          Authentication and session configuration. Environment variables are the source of truth —
          they are never editable from the UI.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
          <h3 className="font-semibold">Session & cookies</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Cookie name</dt>
              <dd className="font-mono text-xs">ao_session</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">COOKIE_SECURE</dt>
              <dd className="font-mono text-xs">{cookieSecure}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">COOKIE_DOMAIN</dt>
              <dd className="font-mono text-xs">{cookieDomain}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">FRONTEND_URL</dt>
              <dd className="max-w-[60%] truncate font-mono text-xs">{frontendUrl}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Session length</dt>
              <dd className="font-mono text-xs">7 days</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
          <h3 className="font-semibold">Password policy</h3>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Staff passwords: minimum 6 characters</li>
            <li>Admin passwords: minimum 8 characters</li>
            <li>Stored with bcrypt hashing</li>
            <li>Default Super Admin / Admin credentials come from environment variables only</li>
          </ul>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-premium lg:col-span-2">
          <h3 className="font-semibold">Role management</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles are fixed in application code (not a database matrix). Middleware and server
            actions recognize these keys:
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Display name</th>
                  <th className="py-2 font-medium">Role key</th>
                </tr>
              </thead>
              <tbody>
                {ALL_ROLES.map((role) => (
                  <tr key={role} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{role}</td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">
                      {roleToKey(role) ?? ROLE_KEYS.ADMIN}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
