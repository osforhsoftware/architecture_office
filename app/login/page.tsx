import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { homePathForRole } from "@/lib/constants"
import { BrandLogo, BrandLogoHeader } from "@/components/brand-logo"
import { LoginForm } from "@/components/login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getCurrentUser()
  if (user) redirect(homePathForRole(user.role))
  const { next } = await searchParams

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col overflow-hidden bg-sidebar text-sidebar-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage:
              "radial-gradient(120% 100% at 20% 0%, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(120% 100% at 20% 0%, black 30%, transparent 75%)",
          }}
        />
        <div
          className="pointer-events-none absolute -left-24 top-1/3 size-96 rounded-full bg-primary/25 blur-3xl"
          aria-hidden
        />
        <BrandLogoHeader
          align="left"
          className="relative border-sidebar-border px-10 py-5"
        />
        <div className="relative flex flex-1 flex-col justify-center px-12 py-8">
          <div className="max-w-md">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-[var(--brass)]">
              Architecture · Interiors · Permits · Construction
            </p>
            <h1 className="text-balance text-3xl font-semibold leading-tight">
              Run your architecture and building permit office in one place.
            </h1>
            <p className="mt-4 text-pretty leading-relaxed text-sidebar-foreground/70">
              Track every project from site visit to handover. Manage clients,
              building permit drawings, 3D and interior work, estimation,
              construction supervision, billing, and staff assignments — all
              backed by a real database.
            </p>
          </div>
        </div>
        <p className="relative px-12 pb-12 text-sm text-sidebar-foreground/50">
          Acmmo Architects
        </p>
      </section>

      <section className="flex flex-col items-center justify-center bg-background px-6 py-12">
        <div className="mb-8 flex w-full max-w-sm justify-center px-2 lg:hidden">
          <BrandLogo priority align="center" variant="light" />
        </div>
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to access your dashboard.
          </p>
          <div className="mt-6">
            <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted" />}>
              <LoginForm nextPath={next} />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  )
}
