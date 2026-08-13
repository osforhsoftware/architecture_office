"use client"

import { publicAssetUrl } from "@/lib/app-urls"
import type { OfficeProfile } from "@/lib/types"
import { getUpiPaymentApp, UPI_PAYMENT_APPS, upiPaymentNumberLabel } from "@/lib/upi-apps"

function assetSrc(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith("data:")) return path
  return publicAssetUrl(path)
}

export function InvoicePaymentDetails({ profile }: { profile: OfficeProfile }) {
  const hasBank =
    profile.bankName ||
    profile.accountName ||
    profile.accountNumber ||
    profile.ifsc ||
    profile.upiId ||
    profile.upiPaymentNumber
  const qr = assetSrc(profile.qrCodeDataUrl)
  const upiApp = getUpiPaymentApp(profile.upiPaymentApp)

  if (!hasBank && !qr) return null

  const rows = [
    ["Bank Name", profile.bankName],
    ["Account Name", profile.accountName],
    ["Account Number", profile.accountNumber],
    ["IFSC", profile.ifsc],
    ["UPI", profile.upiId],
    [upiPaymentNumberLabel(profile.upiPaymentApp), profile.upiPaymentNumber],
  ].filter(([, v]) => Boolean(v)) as [string, string][]

  return (
    <section className="border border-neutral-900/15 bg-white p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900">
        Payment Information
      </h3>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <dl className="grid gap-2 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-neutral-900">{value}</dd>
              </div>
            ))}
          </dl>
          {upiApp || profile.upiId || qr ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-[11px] font-semibold text-neutral-900">Pay via:</span>
              {(upiApp ? [upiApp] : UPI_PAYMENT_APPS).map((app) => {
                const src = assetSrc(app.logoSrc)
                if (!src) return null
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={app.id}
                    src={src}
                    alt={app.label}
                    className="h-3.5 w-auto max-w-[72px] bg-white object-contain object-left"
                  />
                )
              })}
            </div>
          ) : null}
        </div>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="Payment QR code"
            className="size-24 border border-neutral-900/15 object-contain"
          />
        ) : null}
      </div>
    </section>
  )
}

export function InvoiceNotesSection({
  notes,
  onChange,
  maxLength,
}: {
  notes: string
  onChange: (value: string) => void
  maxLength: number
}) {
  return (
    <section className="border border-neutral-900/15 bg-white p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900">
        Notes
      </h3>
      <textarea
        value={notes}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Optional notes for the client"
        className="mt-3 w-full resize-y border border-neutral-900/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#19B5D8]"
      />
    </section>
  )
}

export function InvoiceTermsSection({
  terms,
  onChange,
  maxLength,
}: {
  terms: string
  onChange: (value: string) => void
  maxLength: number
}) {
  return (
    <section className="border border-neutral-900/15 bg-white p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900">
        Terms & Conditions
      </h3>
      <textarea
        value={terms}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Up to 5 concise payment terms"
        className="mt-3 w-full resize-y border border-neutral-900/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#19B5D8]"
      />
    </section>
  )
}

export function InvoiceFooterPreview({ profile }: { profile: OfficeProfile }) {
  const phone = profile.phone?.trim()
  const parts = [
    profile.address,
    phone ? (phone.toLowerCase().startsWith("mob") ? phone : `Mob: ${phone}`) : "",
    profile.email,
    profile.website,
    profile.gstNumber ? `GSTIN ${profile.gstNumber}` : "",
  ].filter(Boolean)

  if (!parts.length) return null

  return (
    <footer className="border-t border-neutral-900/15 pt-3 text-center text-[11px] text-neutral-500">
      {parts.join("  ·  ")}
    </footer>
  )
}
