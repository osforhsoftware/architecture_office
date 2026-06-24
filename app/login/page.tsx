import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { homePathForRole } from "@/lib/constants"
import { BrandLogo, BrandLogoHeader } from "@/components/brand-logo"
import { LoginForm } from "@/components/login-form"

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect(homePathForRole(user.role))

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <BrandLogoHeader
          align="left"
          className="border-sidebar-border px-10 py-5"
        />
        <div className="flex flex-1 flex-col justify-center px-12 py-8">
          <div className="max-w-md">
            <h1 className="text-balance text-3xl font-semibold leading-tight">
              Run your architecture and building permit office in one place.
            </h1>
            <p className="mt-4 text-pretty leading-relaxed text-sidebar-foreground/70">
              Track every project from site visit to handover. Manage clients,
              building permit drawings, 3D and interior work, estimation, billing,
              and staff assignments — all backed by a real database.
            </p>
          </div>
        </div>
        <p className="px-12 pb-12 text-sm text-sidebar-foreground/50">
          Architecture &amp; Building Permit Management System
        </p>
      </section>

      <section className="flex flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex w-full max-w-sm justify-center px-2 lg:hidden">
          <BrandLogo
            className="max-h-16 shadow-sm ring-1 ring-border/50"
            priority
            align="center"
            variant="light"
          />
        </div>
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to access your dashboard.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  )
}
