"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormField, formControlClass, formTextareaClass } from "@/components/form-section"
import { saveOfficeProfile } from "@/lib/actions"
import { apiFetch, publicAssetUrl } from "@/lib/app-urls"
import { DEFAULT_INVOICE_TERMS } from "@/lib/constants"
import type { OfficeProfile } from "@/lib/types"

function buildInitialForm(profile: OfficeProfile) {
  return {
    companyName: profile.companyName ?? "",
    gstNumber: profile.gstNumber ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    website: profile.website ?? "",
    address: profile.address ?? "",
    termsAndConditions: profile.termsAndConditions || DEFAULT_INVOICE_TERMS,
  }
}

function logoPreviewSrc(logo: string | null | undefined): string | null {
  if (!logo) return null
  if (logo.startsWith("data:")) return logo
  return publicAssetUrl(logo)
}

function compressImageFile(file: File, maxSize = 240): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Canvas not supported"))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        0.82,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Invalid image"))
    }
    img.src = url
  })
}

function buildSaveFormData(
  form: ReturnType<typeof buildInitialForm>,
  logoPath: string | null,
  logoPreview: string | null,
): FormData {
  const fd = new FormData()
  fd.set("company_name", form.companyName)
  fd.set("gst_number", form.gstNumber)
  fd.set("phone", form.phone)
  fd.set("email", form.email)
  fd.set("website", form.website)
  fd.set("address", form.address)
  fd.set("terms_and_conditions", form.termsAndConditions)

  if (!logoPreview) {
    fd.set("logo_data_url", "")
  } else if (logoPath) {
    fd.set("logo_data_url", logoPath)
  } else {
    fd.set("logo_data_url", "__KEEP__")
  }

  return fd
}

export function OfficeProfileSettings({ profile }: { profile: OfficeProfile }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [form, setForm] = useState(() => buildInitialForm(profile))
  const [logoPreview, setLogoPreview] = useState<string | null>(() => logoPreviewSrc(profile.logoDataUrl))
  const [logoPath, setLogoPath] = useState<string | null>(
    profile.logoDataUrl?.startsWith("/") ? profile.logoDataUrl : null,
  )
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setForm(buildInitialForm(profile))
    setLogoPreview(logoPreviewSrc(profile.logoDataUrl))
    setLogoPath(profile.logoDataUrl?.startsWith("/") ? profile.logoDataUrl : null)
  }, [
    profile.companyName,
    profile.address,
    profile.phone,
    profile.email,
    profile.website,
    profile.gstNumber,
    profile.termsAndConditions,
    profile.logoDataUrl,
  ])

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB.")
      return
    }

    setUploadingLogo(true)
    try {
      const compressed = await compressImageFile(file)
      const body = new FormData()
      body.set("logo", compressed, "company-logo.jpg")

      const res = await apiFetch("/api/admin/settings/logo", { method: "POST", body })
      const data = (await res.json()) as { path?: string; error?: string }
      if (!res.ok || !data.path) {
        toast.error(data.error ?? "Failed to upload logo.")
        return
      }

      setLogoPath(data.path)
      setLogoPreview(`${publicAssetUrl(data.path) ?? data.path}?v=${Date.now()}`)
      router.refresh()
      toast.success("Logo saved to database")
    } catch {
      toast.error("Failed to process logo image.")
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ""
    }
  }

  function handleRemoveLogo() {
    startTransition(async () => {
      setLogoPreview(null)
      setLogoPath(null)

      const fd = buildSaveFormData(form, null, null)
      const res = await saveOfficeProfile(fd)
      if (res?.error) {
        toast.error(res.error)
        router.refresh()
        return
      }

      router.refresh()
      toast.success("Logo removed")
    })
  }

  function handleSave() {
    startTransition(async () => {
      const fd = buildSaveFormData(form, logoPath, logoPreview)
      const res = await saveOfficeProfile(fd)
      if (res?.error) toast.error(res.error)
      else {
        router.refresh()
        toast.success("Office profile saved to database")
      }
    })
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-premium">
      <div className="flex items-start gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="size-6" />
        </div>
        <div>
          <h3 className="font-semibold">Office Profile</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Company details are saved in the database and appear on every invoice PDF
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <Label className="text-sm font-medium">Company Logo</Label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Company logo preview"
                className="size-16 rounded-lg border border-border object-contain"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                No logo
              </div>
            )}
            <div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingLogo || pending}
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="size-4" />
                {uploadingLogo ? "Uploading..." : logoPreview ? "Change Logo" : "Upload Logo"}
              </Button>
              {logoPreview ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  disabled={pending || uploadingLogo}
                  onClick={handleRemoveLogo}
                >
                  Remove
                </Button>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                PNG or JPG, auto-compressed. Logo is saved immediately on upload.
              </p>
            </div>
          </div>
        </div>

        <FormField label="Company Name" htmlFor="company_name">
          <Input
            id="company_name"
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            required
            className={formControlClass}
          />
        </FormField>
        <FormField label="GST Number (optional)" htmlFor="gst_number">
          <Input
            id="gst_number"
            value={form.gstNumber}
            onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))}
            className={formControlClass}
          />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className={formControlClass}
          />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={formControlClass}
          />
        </FormField>
        <FormField label="Website" htmlFor="website">
          <Input
            id="website"
            type="url"
            placeholder="https://yourcompany.com"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className={formControlClass}
          />
        </FormField>
        <FormField label="Address" htmlFor="address" className="lg:col-span-2">
          <Textarea
            id="address"
            rows={2}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className={formTextareaClass}
          />
        </FormField>
        <FormField label="Default Terms & Conditions" htmlFor="terms_and_conditions" className="lg:col-span-2">
          <Textarea
            id="terms_and_conditions"
            rows={4}
            value={form.termsAndConditions}
            onChange={(e) => setForm((f) => ({ ...f, termsAndConditions: e.target.value }))}
            className={formTextareaClass}
          />
        </FormField>
      </div>

      <Button
        type="button"
        className="mt-6 min-h-11"
        disabled={pending || uploadingLogo}
        onClick={handleSave}
      >
        {pending ? "Saving..." : "Save Office Profile"}
      </Button>
    </div>
  )
}
