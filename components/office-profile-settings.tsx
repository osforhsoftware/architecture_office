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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { saveOfficeProfile } from "@/lib/actions"
import { apiFetch, publicAssetUrl } from "@/lib/app-urls"
import { DEFAULT_INVOICE_TERMS } from "@/lib/constants"
import type { OfficeProfile } from "@/lib/types"
import { getUpiPaymentApp, UPI_PAYMENT_APPS, type UpiPaymentAppId } from "@/lib/upi-apps"

function buildInitialForm(profile: OfficeProfile) {
  return {
    companyName: profile.companyName ?? "",
    gstNumber: profile.gstNumber ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    website: profile.website ?? "",
    address: profile.address ?? "",
    tagline: profile.tagline ?? "Architecture • Interiors • Planning",
    termsAndConditions: profile.termsAndConditions || DEFAULT_INVOICE_TERMS,
    bankName: profile.bankName ?? "",
    accountName: profile.accountName ?? "",
    accountNumber: profile.accountNumber ?? "",
    ifsc: profile.ifsc ?? "",
    upiId: profile.upiId ?? "",
    upiPaymentNumber: profile.upiPaymentNumber ?? "",
    upiPaymentApp: profile.upiPaymentApp ?? "",
    architectName: profile.architectName ?? "",
    architectDesignation: profile.architectDesignation ?? "Principal Architect",
  }
}

function logoPreviewSrc(logo: string | null | undefined): string | null {
  if (!logo) return null
  if (logo.startsWith("data:")) return logo
  return publicAssetUrl(logo)
}

function isNearBlack(r: number, g: number, b: number, threshold = 28) {
  return r <= threshold && g <= threshold && b <= threshold
}

/** Flatten PNG/WebP transparency (and solid black backdrops) onto white for invoice/PDF use. */
function compressImageFile(file: File, maxSize = 240): Promise<File> {
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
      // JPEG has no alpha — fill white so transparent areas stay white
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      const isPngLike = file.type === "image/png" || file.type === "image/webp"
      if (isPngLike) {
        const imageData = ctx.getImageData(0, 0, width, height)
        const d = imageData.data
        const cornerIdx = [
          0,
          (width - 1) * 4,
          (height - 1) * width * 4,
          ((height - 1) * width + (width - 1)) * 4,
        ]
        const blackCorners = cornerIdx.filter((i) =>
          isNearBlack(d[i]!, d[i + 1]!, d[i + 2]!),
        ).length
        // Solid black backdrop (common on logo PNGs) → white
        if (blackCorners >= 3) {
          for (let i = 0; i < d.length; i += 4) {
            if (isNearBlack(d[i]!, d[i + 1]!, d[i + 2]!)) {
              d[i] = 255
              d[i + 1] = 255
              d[i + 2] = 255
            }
          }
          ctx.putImageData(imageData, 0, 0)
        }
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"))
            return
          }
          resolve(new File([blob], "image.jpg", { type: "image/jpeg" }))
        },
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

type AssetKind = "logo" | "qr"

function buildSaveFormData(
  form: ReturnType<typeof buildInitialForm>,
  logoPath: string | null,
  logoPreview: string | null,
  qrPath: string | null,
  qrPreview: string | null,
): FormData {
  const fd = new FormData()
  fd.set("company_name", form.companyName)
  fd.set("gst_number", form.gstNumber)
  fd.set("phone", form.phone)
  fd.set("email", form.email)
  fd.set("website", form.website)
  fd.set("address", form.address)
  fd.set("tagline", form.tagline)
  fd.set("terms_and_conditions", form.termsAndConditions)
  fd.set("bank_name", form.bankName)
  fd.set("account_name", form.accountName)
  fd.set("account_number", form.accountNumber)
  fd.set("ifsc", form.ifsc)
  fd.set("upi_id", form.upiId)
  fd.set("upi_payment_number", form.upiPaymentNumber ?? "")
  fd.set("upi_payment_app", form.upiPaymentApp || "none")
  fd.set("architect_name", form.architectName)
  fd.set("architect_designation", form.architectDesignation)

  if (!logoPreview) fd.set("logo_data_url", "")
  else if (logoPath) fd.set("logo_data_url", logoPath)
  else fd.set("logo_data_url", "__KEEP__")

  if (!qrPreview) fd.set("qr_code_data_url", "")
  else if (qrPath) fd.set("qr_code_data_url", qrPath)
  else fd.set("qr_code_data_url", "__KEEP__")

  // Signature upload UI removed; preserve any existing stored signature.
  fd.set("signature_data_url", "__KEEP__")

  return fd
}

function ImageUploadField({
  label,
  preview,
  uploading,
  pending,
  onUpload,
  onRemove,
  hint,
}: {
  label: string
  preview: string | null
  uploading: boolean
  pending: boolean
  onUpload: (file: File) => void
  onRemove?: () => void
  hint: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-2 lg:col-span-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={label}
            className="size-16 rounded-lg border border-border bg-white object-contain p-1"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
            None
          </div>
        )}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              if (inputRef.current) inputRef.current.value = ""
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || pending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {uploading ? "Uploading..." : preview ? "Change" : "Upload"}
          </Button>
          {preview && onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-2"
              disabled={pending || uploading}
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  )
}

export function OfficeProfileSettings({ profile }: { profile: OfficeProfile }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState<AssetKind | null>(null)
  const [form, setForm] = useState(() => buildInitialForm(profile))
  const [logoPreview, setLogoPreview] = useState<string | null>(() =>
    logoPreviewSrc(profile.logoDataUrl),
  )
  const [logoPath, setLogoPath] = useState<string | null>(
    profile.logoDataUrl?.startsWith("/") ? profile.logoDataUrl : null,
  )
  const [qrPreview, setQrPreview] = useState<string | null>(() =>
    logoPreviewSrc(profile.qrCodeDataUrl),
  )
  const [qrPath, setQrPath] = useState<string | null>(
    profile.qrCodeDataUrl?.startsWith("/") ? profile.qrCodeDataUrl : null,
  )

  useEffect(() => {
    setForm(buildInitialForm(profile))
    setLogoPreview(logoPreviewSrc(profile.logoDataUrl))
    setLogoPath(profile.logoDataUrl?.startsWith("/") ? profile.logoDataUrl : null)
    setQrPreview(logoPreviewSrc(profile.qrCodeDataUrl))
    setQrPath(profile.qrCodeDataUrl?.startsWith("/") ? profile.qrCodeDataUrl : null)
  }, [profile])

  async function uploadAsset(kind: AssetKind, file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB.")
      return
    }
    setUploading(kind)
    try {
      const compressed = await compressImageFile(file, kind === "qr" ? 320 : 240)
      const body = new FormData()
      body.set("kind", kind)
      body.set(kind === "logo" ? "logo" : "file", compressed, `${kind}.jpg`)

      const res = await apiFetch("/api/admin/settings/logo", { method: "POST", body })
      const data = (await res.json()) as { path?: string; error?: string }
      if (!res.ok || !data.path) {
        toast.error(data.error ?? "Failed to upload image.")
        return
      }
      const preview = `${publicAssetUrl(data.path) ?? data.path}?v=${Date.now()}`
      if (kind === "logo") {
        setLogoPath(data.path)
        setLogoPreview(preview)
      } else {
        setQrPath(data.path)
        setQrPreview(preview)
      }
      router.refresh()
      toast.success("Image saved")
    } catch {
      toast.error("Failed to process image.")
    } finally {
      setUploading(null)
    }
  }

  function handleSave() {
    startTransition(async () => {
      const fd = buildSaveFormData(form, logoPath, logoPreview, qrPath, qrPreview)
      const res = await saveOfficeProfile(fd)
      if (res?.error) toast.error(res.error)
      else {
        router.refresh()
        toast.success("Office profile saved to database")
      }
    })
  }

  function removeAsset(kind: AssetKind) {
    startTransition(async () => {
      if (kind === "logo") {
        setLogoPreview(null)
        setLogoPath(null)
      } else {
        setQrPreview(null)
        setQrPath(null)
      }
      const fd = buildSaveFormData(
        form,
        kind === "logo" ? null : logoPath,
        kind === "logo" ? null : logoPreview,
        kind === "qr" ? null : qrPath,
        kind === "qr" ? null : qrPreview,
      )
      if (kind === "logo") {
        fd.set("logo_data_url", "")
      } else {
        fd.set("qr_code_data_url", "")
      }
      const res = await saveOfficeProfile(fd)
      if (res?.error) {
        toast.error(res.error)
        router.refresh()
        return
      }
      router.refresh()
      toast.success("Removed")
    })
  }

  const selectedUpiApp = getUpiPaymentApp(form.upiPaymentApp)

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-premium">
      <div className="flex items-start gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="size-6" />
        </div>
        <div>
          <h3 className="font-semibold">Office Profile</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Company and payment details appear on every invoice PDF
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ImageUploadField
          label="Company Logo"
          preview={logoPreview}
          uploading={uploading === "logo"}
          pending={pending}
          onUpload={(f) => uploadAsset("logo", f)}
          onRemove={() => removeAsset("logo")}
          hint="PNG or JPG. Saved immediately on upload."
        />

        <FormField label="Company Name" htmlFor="company_name">
          <Input
            id="company_name"
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            required
            className={formControlClass}
          />
        </FormField>
        <FormField label="Tagline" htmlFor="tagline">
          <Input
            id="tagline"
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            placeholder="Architecture • Interiors • Planning"
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

        <div className="lg:col-span-2">
          <h4 className="mb-3 text-sm font-semibold">Payment Details (Invoice)</h4>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Bank Name" htmlFor="bank_name">
              <Input
                id="bank_name"
                value={form.bankName}
                onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                className={formControlClass}
              />
            </FormField>
            <FormField label="Account Name" htmlFor="account_name">
              <Input
                id="account_name"
                value={form.accountName}
                onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                className={formControlClass}
              />
            </FormField>
            <FormField label="Account Number" htmlFor="account_number">
              <Input
                id="account_number"
                value={form.accountNumber}
                onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                className={formControlClass}
              />
            </FormField>
            <FormField label="IFSC" htmlFor="ifsc">
              <Input
                id="ifsc"
                value={form.ifsc}
                onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value }))}
                className={formControlClass}
              />
            </FormField>
            <FormField label="UPI ID" htmlFor="upi_id">
              <Input
                id="upi_id"
                value={form.upiId}
                onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))}
                placeholder="studio@upi"
                className={formControlClass}
              />
            </FormField>
            <FormField label="UPI Payment Number" htmlFor="upi_payment_number">
              <Input
                id="upi_payment_number"
                value={form.upiPaymentNumber ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, upiPaymentNumber: e.target.value }))}
                inputMode="tel"
                className={formControlClass}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Google Pay / PhonePe / Paytm registered mobile number shown on invoices.
              </p>
            </FormField>
            <FormField label="UPI Payment App" htmlFor="upi_payment_app">
              <Select
                value={form.upiPaymentApp || "none"}
                onValueChange={(value) => {
                  if (!value) return
                  setForm((f) => ({
                    ...f,
                    upiPaymentApp: value === "none" ? "" : (value as UpiPaymentAppId),
                  }))
                }}
              >
                <SelectTrigger id="upi_payment_app" className={formControlClass}>
                  <SelectValue placeholder="Select UPI app" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {UPI_PAYMENT_APPS.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {UPI_PAYMENT_APPS.map((app) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={app.id}
                    src={publicAssetUrl(app.logoSrc) ?? app.logoSrc}
                    alt={app.label}
                    className="h-[18px] w-auto max-w-[96px] bg-white object-contain object-left"
                  />
                ))}
              </div>
              {selectedUpiApp ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Invoice will show only {selectedUpiApp.label}.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  All three official logos appear on invoices. Select one to show only that app.
                </p>
              )}
            </FormField>
            <ImageUploadField
              label="Payment QR Code (optional)"
              preview={qrPreview}
              uploading={uploading === "qr"}
              pending={pending}
              onUpload={(f) => uploadAsset("qr", f)}
              onRemove={() => removeAsset("qr")}
              hint="Upload a UPI / bank QR image for invoices."
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <h4 className="mb-3 text-sm font-semibold">Authorization</h4>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField label="Architect Name" htmlFor="architect_name">
              <Input
                id="architect_name"
                value={form.architectName}
                onChange={(e) => setForm((f) => ({ ...f, architectName: e.target.value }))}
                className={formControlClass}
              />
            </FormField>
            <FormField label="Designation" htmlFor="architect_designation">
              <Input
                id="architect_designation"
                value={form.architectDesignation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, architectDesignation: e.target.value }))
                }
                className={formControlClass}
              />
            </FormField>
          </div>
        </div>

        <FormField
          label="Default Terms & Conditions"
          htmlFor="terms_and_conditions"
          className="lg:col-span-2"
        >
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
        disabled={pending || uploading !== null}
        onClick={handleSave}
      >
        {pending ? "Saving..." : "Save Office Profile"}
      </Button>
    </div>
  )
}
