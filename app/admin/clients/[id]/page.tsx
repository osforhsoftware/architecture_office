import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Phone, Mail, MapPin, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getClient, getProjectsByClient } from "@/lib/queries"
import { ClientDialog } from "@/components/client-dialog"
import { StatusBadge, PriorityBadge } from "@/components/status-badges"
import { formatClientId, formatCurrency } from "@/lib/constants"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const clientId = Number(id)
  const client = await getClient(clientId)
  if (!client || client.source === "finance") notFound()

  const projects = await getProjectsByClient(clientId)

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/clients"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to clients
      </Link>

      <Card>
        <CardContent className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {client.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-xl font-semibold">{client.name}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{formatClientId(client.id)}</p>
              <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                {client.phone ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0" />
                    <span className="break-all">{client.phone}</span>
                  </span>
                ) : null}
                {client.email ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="break-all">{client.email}</span>
                  </span>
                ) : null}
              </div>
              {client.address || client.street || client.district ? (
                <p className="mt-1 flex items-start gap-1.5 break-words text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 break-words">
                    {[client.address, client.street, client.district].filter(Boolean).join(", ")}
                  </span>
                </p>
              ) : null}
              {client.aadhaar_numbers?.length ? (
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  Aadhaar: {client.aadhaar_numbers.join(", ")}
                </p>
              ) : null}
              {client.linked_numbers?.length ? (
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  Linked: {client.linked_numbers.join(", ")}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={`/admin/invoices/new?fromClient=${client.id}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Plus className="size-4" /> Add Invoice
            </Link>
            <ClientDialog client={client} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Projects ({projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/admin/projects/${p.id}`}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.code} • {formatCurrency(p.project_amount)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PriorityBadge priority={p.priority} />
                <StatusBadge status={p.status} />
              </div>
            </Link>
          ))}
          {projects.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No projects for this client yet.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
