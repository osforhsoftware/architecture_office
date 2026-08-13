import type { Role } from "./constants"
import type { UpiPaymentAppId } from "./upi-apps"

export interface AppUser {
  id: number
  username: string
  /** Primary role (portal routing + backward-compatible single-role column). */
  role: Role
  /** All department roles for this staff member (multi-role). Falls back to `[role]`. */
  roles?: Role[]
  name: string
  email: string | null
  phone: string | null
  /** Public path or URL for staff profile image. */
  avatar_url?: string | null
  active: boolean
  created_at?: string
}

export interface Client {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  street: string | null
  district: string | null
  aadhaar_numbers: string[]
  linked_numbers: string[]
  created_at: string
  project_count?: number
}

export interface Project {
  id: number
  code: string
  name: string
  client_id: number
  location: string | null
  type: string | null
  priority: string
  status: string
  section: string
  current_stage: number
  assigned_to: number | null
  due_date: string | null
  project_amount: string
  advance_received: string
  invoice_number: string | null
  payment_status: string
  review_note: string | null
  notes: string | null
  building_number: string | null
  building_permit_number: string | null
  drawing_number: string | null
  edgebook_number: string | null
  refer_name: string | null
  req_architectural_plan: boolean
  req_building_permit: boolean
  req_regularization: boolean
  project_package: string | null
  current_workflow_step_id: number | null
  work_completed_at: string | null
  created_at: string
  updated_at: string
  client_name?: string
  client_phone?: string
  assignee_name?: string | null
  site_assignee_ids?: number[]
  site_assignee_names?: string[]
}

export interface ProjectAssignee {
  user_id: number
  name: string
  stage_key: string
}

export interface StatusHistory {
  id: number
  project_id: number
  status: string
  note: string | null
  created_by: string | null
  created_at: string
}

export interface ReturnHistory {
  id: number
  project_id: number
  reason: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface ProjectFile {
  id: number
  project_id: number
  name: string
  file_type: string | null
  category: string | null
  uploaded_by: number | null
  version: number
  storage_path: string | null
  created_at: string
  uploader_name?: string | null
}

export interface ChecklistItem {
  id: number
  project_id: number
  item_key: string
  service_key: string | null
  checked: boolean
  filed: boolean
  review_status: string
}

export interface ProjectKmapArea {
  id: number
  project_id: number
  floor_key: string
  plinth_area: string | null
  floor_area: string | null
}

export interface Payment {
  id: number
  project_id: number
  amount: string
  method: string
  note: string | null
  recorded_by: number | null
  created_at: string
  recorder_name?: string | null
}

export interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  message: string | null
  read: boolean
  created_at: string
}

export interface AuditLog {
  id: number
  user_id: number | null
  role: string | null
  action: string
  entity_type: string
  entity_id: number | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  user_name?: string | null
}

export type InvoiceStatus =
  | "Draft"
  | "Sent"
  | "Pending"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Cancelled"

export interface OfficeProfile {
  companyName: string
  address: string
  phone: string
  email: string
  website?: string
  gstNumber: string
  logoDataUrl: string | null
  termsAndConditions: string
  tagline?: string
  /** Payment details shown on invoice PDF */
  bankName?: string
  accountName?: string
  accountNumber?: string
  ifsc?: string
  upiId?: string
  /** Google Pay / PhonePe / Paytm registered mobile number shown on invoices. */
  upiPaymentNumber?: string
  /** Selected UPI app shown on invoices (Google Pay / PhonePe / Paytm). */
  upiPaymentApp?: UpiPaymentAppId | ""
  qrCodeDataUrl?: string | null
  /** Resolved at PDF generation time only — not persisted. */
  upiAppLogoDataUrl?: string | null
  upiAppLogos?: Partial<Record<UpiPaymentAppId, string | null>>
  /** Authorization / signature block */
  architectName?: string
  architectDesignation?: string
  signatureDataUrl?: string | null
}

export interface InvoiceLineItem {
  id?: number
  invoice_id?: number
  description: string
  quantity: string
  unit?: string | null
  unit_price: string
  /** Per-unit discount in ₹ (optional for legacy rows). */
  discount_amount?: string | null
  discount_percent?: string | null
  amount: string
  sort_order?: number
}

export interface InvoicePayment {
  id: number
  invoice_id: number
  amount: string
  payment_date: string
  method: string
  notes: string | null
  recorded_by: number | null
  created_at: string
  recorder_name?: string | null
}

export interface Invoice {
  id: number
  project_id: number | null
  invoice_number: string
  status: InvoiceStatus
  invoice_date: string
  due_date: string | null
  client_name: string
  client_address: string | null
  client_email: string | null
  client_phone: string | null
  client_tax_id: string | null
  project_name: string | null
  notes: string | null
  terms: string | null
  subtotal: string
  tax_percent: string
  tax_amount: string
  discount_percent: string
  discount_amount: string
  total: string
  amount_paid: string
  balance: string
  created_by: number | null
  created_at: string
  updated_at: string
  project_code?: string | null
  project_location?: string | null
  creator_name?: string | null
}

export interface InvoiceWithDetails extends Invoice {
  line_items: InvoiceLineItem[]
  payments: InvoicePayment[]
}
