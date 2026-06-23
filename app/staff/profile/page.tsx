import { Building2, LogOut, Mail, Phone, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { logoutAction } from "@/lib/actions"

export default async function StaffProfilePage() {
  const user = await getCurrentUser()
  if (!user) return null

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
          {user.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{user.name}</h2>
          <p className="text-sm text-muted-foreground">{user.role}</p>
        </div>
      </div>

      <Card className="shadow-none">
        <CardContent className="divide-y divide-border p-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <User className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Username</p>
              <p className="text-sm font-medium">{user.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Building2 className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="text-sm font-medium">{user.role}</p>
            </div>
          </div>
          {user.email ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <Mail className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user.email}</p>
              </div>
            </div>
          ) : null}
          {user.phone ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <Phone className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{user.phone}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <form action={logoutAction}>
        <button
          type="submit"
          suppressHydrationWarning
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium text-destructive transition-colors active:bg-muted/50"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </div>
  )
}
