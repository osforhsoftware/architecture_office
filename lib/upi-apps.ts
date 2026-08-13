export const UPI_PAYMENT_APP_IDS = ["gpay", "phonepe", "paytm"] as const

export type UpiPaymentAppId = (typeof UPI_PAYMENT_APP_IDS)[number]

export const UPI_PAYMENT_APPS: {
  id: UpiPaymentAppId
  label: string
  logoSrc: string
  logoPngSrc: string
  /** Official lockup already includes the app name. */
  lockup: true
}[] = [
  {
    id: "gpay",
    label: "Google Pay",
    logoSrc: "/assets/upi/gpay.png",
    logoPngSrc: "/assets/upi/gpay.png",
    lockup: true,
  },
  {
    id: "phonepe",
    label: "PhonePe",
    logoSrc: "/assets/upi/phonepe.png",
    logoPngSrc: "/assets/upi/phonepe.png",
    lockup: true,
  },
  {
    id: "paytm",
    label: "Paytm",
    logoSrc: "/assets/upi/paytm.png",
    logoPngSrc: "/assets/upi/paytm.png",
    lockup: true,
  },
]

export function isUpiPaymentAppId(value: unknown): value is UpiPaymentAppId {
  return typeof value === "string" && (UPI_PAYMENT_APP_IDS as readonly string[]).includes(value)
}

export function parseUpiPaymentApp(value: unknown): UpiPaymentAppId | "" {
  if (value === "none" || value == null) return ""
  const raw = String(value).trim().toLowerCase()
  return isUpiPaymentAppId(raw) ? raw : ""
}

export function getUpiPaymentApp(id?: string | null) {
  if (!id) return null
  return UPI_PAYMENT_APPS.find((app) => app.id === id) ?? null
}

/** Invoice label for the UPI / GPay registered mobile number. */
export function upiPaymentNumberLabel(appId?: string | null): string {
  if (appId === "gpay") return "GPay Number"
  if (appId === "phonepe") return "PhonePe Number"
  if (appId === "paytm") return "Paytm Number"
  return "UPI Number"
}
