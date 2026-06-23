"use client"

import { useEffect, useState, useTransition } from "react"
import { Plus, Pencil } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient, updateClient } from "@/lib/actions"
import type { Client } from "@/lib/types"

export function ClientDialog({ client }: { client?: Client }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(client)
  const fieldId = client ? `client-${client.id}` : "client-new"

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")

  useEffect(() => {
    if (!open) return
    setName(client?.name ?? "")
    setPhone(client?.phone ?? "")
    setEmail(client?.email ?? "")
    setAddress(client?.address ?? "")
    setError(null)
  }, [open, client])

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = isEdit ? await updateClient(formData) : await createClient(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Client updated" : "Client added")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> Edit
            </Button>
          ) : (
            <Button>
              <Plus className="size-4" /> Add Client
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Client" : "Add Client"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the client's contact details."
              : "Add a new client to the office directory."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <form action={onSubmit} className="flex flex-col gap-4">
            {isEdit ? <input type="hidden" name="id" value={client!.id} /> : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-name`}>Full name</Label>
              <Input
                id={`${fieldId}-name`}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldId}-phone`}>Phone</Label>
                <Input
                  id={`${fieldId}-phone`}
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldId}-email`}>Email</Label>
                <Input
                  id={`${fieldId}-email`}
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-address`}>Address</Label>
              <Textarea
                id={`${fieldId}-address`}
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : isEdit ? "Save changes" : "Add client"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
