import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Phone, Mail, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  if (!client) notFound()

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
        <CardContent className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {client.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{client.name}</h2>
              <p className="text-xs text-muted-foreground">{formatClientId(client.id)}</p>
              <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:gap-4">
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" /> {client.phone}
                </span>
                {client.email ? (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" /> {client.email}
                  </span>
                ) : null}
              </div>
              {client.address ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" /> {client.address}
                </p>
              ) : null}
            </div>
          </div>
          <ClientDialog client={client} />
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
