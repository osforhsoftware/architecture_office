import type { Role } from "./constants"

export interface AppUser {
  id: number
  username: string
  role: Role
  name: string
  email: string | null
  phone: string | null
  active: boolean
  created_at?: string
}

export interface Client {
  id: number
  name: string
  phone: string
  email: string | null
  address: string | null
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
  created_at: string
  updated_at: string
  client_name?: string
  client_phone?: string
  assignee_name?: string | null
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
  checked: boolean
  review_status: string
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
  action: string
  entity_type: string
  entity_id: number | null
  details: Record<string, unknown> | null
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
}

export interface InvoiceLineItem {
  id?: number
  invoice_id?: number
  description: string
  quantity: string
  unit?: string | null
  unit_price: string
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
  creator_name?: string | null
}

export interface InvoiceWithDetails extends Invoice {
  line_items: InvoiceLineItem[]
  payments: InvoicePayment[]
}
