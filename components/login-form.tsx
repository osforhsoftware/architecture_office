"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { loginAction } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  )
}

const DEMO_ACCOUNTS = [
  { label: "Admin", username: "admin", password: "admin123" },
  { label: "Planning Staff", username: "planning", password: "plan123" },
  { label: "Permit Staff", username: "permit", password: "permit123" },
  { label: "3D Staff", username: "3d", password: "3d123" },
  { label: "Estimation Staff", username: "estimate", password: "est123" },
  { label: "Billing Staff", username: "billing", password: "bill123" },
]

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, null)

  return (
    <div className="w-full max-w-sm">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            placeholder="e.g. admin"
            autoComplete="username"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>
        {state?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        <SubmitButton />
      </form>

      <div className="mt-8 rounded-lg border border-border bg-muted/40 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Demo accounts (password shown)
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.username} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{a.label}</span>
              <code className="rounded bg-background px-2 py-0.5 text-xs">
                {a.username} / {a.password}
              </code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
