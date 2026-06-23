import { redirect } from "next/navigation"
import Image from "next/image"
import { getCurrentUser } from "@/lib/auth"
import { homePathForRole } from "@/lib/constants"
import { LoginForm } from "@/components/login-form"

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect(homePathForRole(user.role))

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Image src="/assets/osforh-logo.png" alt="Osforh Logo" width={40} height={40} />
          </div>
          <span className="text-lg font-semibold">ArchPermit Office</span>
        </div>
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
        <p className="text-sm text-sidebar-foreground/50">
          Architecture &amp; Building Permit Management System
        </p>
      </section>

      <section className="flex flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Image src="/assets/osforh-logo.png" alt="Osforh Logo" width={40} height={40} />
          </div>
          <span className="text-lg font-semibold">ArchPermit Office</span>
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
