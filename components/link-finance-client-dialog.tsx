"use client"

import { useState, useTransition } from "react"
import { Link2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormSelect } from "@/components/form-select"
import { FormField } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { linkClientToFinance } from "@/lib/actions"

export function LinkFinanceClientDialog({
  clients,
}: {
  clients: { id: number; name: string; phone?: string | null }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const options = clients.map((client) => ({
    value: String(client.id),
    label: client.phone ? `${client.name} · ${client.phone}` : client.name,
  }))

  function onSubmit(formData: FormData) {
    setError(null)
    if (!clientId) {
      setError("Select a client to link.")
      return
    }
    formData.set("client_id", clientId)
    startTransition(async () => {
      const res = await linkClientToFinance(formData)
      if (res && "error" in res && res.error) {
        setError(String(res.error))
        return
      }
      toast.success("Client linked to Finance")
      setClientId(null)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setError(null)
          setClientId(null)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Link2 className="size-4" /> Link Existing Client
          </Button>
        }
      />
      <FormDialogShell
        title="Link Existing Client"
        description="Choose a client from previous projects. They stay in the Clients list and also appear in Finance."
        size="md"
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every office client is already in Finance, or there are no office clients yet.
                </p>
              ) : (
                <FormField label="Client">
                  <FormSelect
                    name="client_id"
                    options={options}
                    value={clientId}
                    onValueChange={setClientId}
                    placeholder="Select client"
                    searchable
                    searchPlaceholder="Search clients..."
                    emptyMessage="No clients match that search."
                  />
                </FormField>
              )}
              {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            </FormDialogBody>
            <FormDialogFooter
              submitLabel={pending ? "Linking..." : "Link to Finance"}
              pending={pending}
              submitDisabled={clients.length === 0 || !clientId}
            />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
