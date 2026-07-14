"use client"

import { useEffect, useState, useTransition } from "react"
import { Plus, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { AadhaarFields } from "@/components/aadhaar-fields"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormSelect } from "@/components/form-select"
import { FormField, FormSection, formControlClass, formTextareaClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient, updateClient } from "@/lib/actions"
import { KERALA_DISTRICTS } from "@/lib/constants"
import type { Client } from "@/lib/types"

const DISTRICT_OPTIONS = KERALA_DISTRICTS.map((d) => ({ value: d, label: d }))

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
  const [street, setStreet] = useState("")
  const [district, setDistrict] = useState<string | null>(null)
  const [aadhaarNumbers, setAadhaarNumbers] = useState<string[]>([""])

  useEffect(() => {
    if (!open) return
    setName(client?.name ?? "")
    setPhone(client?.phone ?? "")
    setEmail(client?.email ?? "")
    setAddress(client?.address ?? "")
    setStreet(client?.street ?? "")
    setDistrict(client?.district ?? null)
    setAadhaarNumbers(
      client?.aadhaar_numbers?.length ? [...client.aadhaar_numbers] : [""],
    )
    setError(null)
  }, [open, client])

  function onSubmit(formData: FormData) {
    setError(null)
    formData.set(
      "aadhaar_numbers",
      JSON.stringify(aadhaarNumbers.map((n) => n.trim()).filter(Boolean)),
    )
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
      <FormDialogShell
        title={isEdit ? "Edit Client" : "Add Client"}
        description={
          isEdit
            ? "Update the client's contact details."
            : "Add a new client to the office directory."
        }
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {isEdit ? <input type="hidden" name="id" value={client!.id} /> : null}

            <FormDialogBody>
              <div className="flex flex-col gap-5">
                <FormSection title="Contact Information">
                  <div className="flex flex-col gap-3">
                    <FormField label="Full name" htmlFor={`${fieldId}-name`}>
                      <Input
                        id={`${fieldId}-name`}
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className={formControlClass}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Phone" htmlFor={`${fieldId}-phone`}>
                        <Input
                          id={`${fieldId}-phone`}
                          name="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                          className={formControlClass}
                        />
                      </FormField>
                      <FormField label="Email" htmlFor={`${fieldId}-email`}>
                        <Input
                          id={`${fieldId}-email`}
                          name="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={formControlClass}
                        />
                      </FormField>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Address">
                  <div className="flex flex-col gap-3">
                    <FormField label="Address" htmlFor={`${fieldId}-address`}>
                      <Textarea
                        id={`${fieldId}-address`}
                        name="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className={formTextareaClass}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Street" htmlFor={`${fieldId}-street`}>
                        <Input
                          id={`${fieldId}-street`}
                          name="street"
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          className={formControlClass}
                        />
                      </FormField>
                      <FormField label="District" htmlFor={`${fieldId}-district`}>
                        <FormSelect
                          id={`${fieldId}-district`}
                          name="district"
                          placeholder="Select district"
                          options={DISTRICT_OPTIONS}
                          value={district}
                          onValueChange={setDistrict}
                          className={formControlClass}
                        />
                      </FormField>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Identity">
                  <AadhaarFields values={aadhaarNumbers} onChange={setAadhaarNumbers} />
                </FormSection>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            </FormDialogBody>

            <FormDialogFooter
              submitLabel={pending ? "Saving..." : isEdit ? "Save Changes" : "Add Client"}
              pending={pending}
            />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
