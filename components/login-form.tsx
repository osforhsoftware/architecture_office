"use client"

import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { Eye, EyeOff } from "lucide-react"
import { loginAction } from "@/lib/auth-actions"
import { FormField, formControlClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function SubmitButton({ redirecting }: { redirecting?: boolean }) {
  const { pending } = useFormStatus()
  const busy = pending || redirecting
  return (
    <Button type="submit" className="min-h-11 w-full" disabled={busy}>
      {busy ? (redirecting ? "Redirecting..." : "Signing in...") : "Sign in"}
    </Button>
  )
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction] = useActionState(loginAction, null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!state?.redirectTo) return
    window.location.assign(state.redirectTo)
  }, [state])

  return (
    <div className="w-full max-w-sm">
      <form action={formAction} className="flex flex-col gap-4">
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <FormField label="Email or username" htmlFor="username">
          <Input
            id="username"
            name="username"
            placeholder="Enter your email or username"
            autoComplete="username"
            required
            className={formControlClass}
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className={`${formControlClass} pr-10`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </FormField>
        {state?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        <SubmitButton redirecting={Boolean(state?.redirectTo)} />
      </form>
    </div>
  )
}
