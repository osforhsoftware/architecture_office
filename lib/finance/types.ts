import type {
  FinanceExpenseStatus,
  FinanceIncomeStatus,
  StaffClaimStatus,
  SalaryStatus,
  AccountType,
  LedgerScope,
} from "./constants"

export interface FinanceAccount {
  id: number
  name: string
  account_type: AccountType | string
  bank_name: string | null
  account_number: string | null
  opening_balance: string
  current_balance: string
  active: boolean
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface IncomeCategory {
  id: number
  name: string
  icon: string
  color: string
  active: boolean
  sort_order: number
  scope?: LedgerScope | "both" | string
  created_at: string
}

export interface ExpenseCategory {
  id: number
  name: string
  icon: string
  color: string
  active: boolean
  sort_order: number
  scope?: LedgerScope | "both" | string
  created_at: string
}

export interface Vendor {
  id: number
  name: string
  phone: string | null
  email: string | null
  gst: string | null
  address: string | null
  notes: string | null
  outstanding_balance: string
  active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  bill_count?: number
  payment_count?: number
}

export interface FinanceIncome {
  id: number
  receipt_number: string
  income_date: string
  client_id: number | null
  project_id: number | null
  invoice_id: number | null
  category_id: number | null
  account_id: number | null
  payment_method: string
  amount: string
  reference_number: string | null
  notes: string | null
  attachment_path: string | null
  status: FinanceIncomeStatus | string
  created_by: number | null
  approved_by: number | null
  approved_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  client_name?: string | null
  project_name?: string | null
  project_code?: string | null
  category_name?: string | null
  category_color?: string | null
  account_name?: string | null
  creator_name?: string | null
  approver_name?: string | null
  ledger_scope?: LedgerScope | string
}

export interface FinanceExpense {
  id: number
  expense_number: string
  expense_date: string
  vendor_id: number | null
  project_id: number | null
  category_id: number | null
  account_id: number | null
  amount: string
  gst_amount: string
  payment_method: string
  reference_number: string | null
  notes: string | null
  bill_path: string | null
  status: FinanceExpenseStatus | string
  created_by: number | null
  approved_by: number | null
  approved_at: string | null
  paid_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  vendor_name?: string | null
  project_name?: string | null
  project_code?: string | null
  category_name?: string | null
  category_color?: string | null
  account_name?: string | null
  creator_name?: string | null
  approver_name?: string | null
  ledger_scope?: LedgerScope | string
}

export interface StaffExpenseClaim {
  id: number
  claim_number: string
  staff_id: number
  project_id: number | null
  category: string
  amount: string
  claim_date: string
  receipt_path: string | null
  gps_lat: string | null
  gps_lng: string | null
  notes: string | null
  status: StaffClaimStatus | string
  dept_reviewed_by: number | null
  dept_reviewed_at: string | null
  admin_approved_by: number | null
  admin_approved_at: string | null
  paid_by: number | null
  paid_at: string | null
  account_id: number | null
  rejection_reason: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  staff_name?: string | null
  project_name?: string | null
  project_code?: string | null
  account_name?: string | null
}

export interface VendorPayment {
  id: number
  vendor_id: number
  expense_id: number | null
  amount: string
  payment_date: string
  payment_method: string
  account_id: number | null
  reference: string | null
  notes: string | null
  created_by: number | null
  deleted_at: string | null
  created_at: string
  account_name?: string | null
  creator_name?: string | null
}

export interface BankTransfer {
  id: number
  transfer_number: string
  from_account_id: number
  to_account_id: number
  amount: string
  transfer_date: string
  reference: string | null
  notes: string | null
  created_by: number | null
  deleted_at: string | null
  created_at: string
  from_account_name?: string | null
  to_account_name?: string | null
  creator_name?: string | null
}

export interface FinanceTransaction {
  id: number
  transaction_number: string
  transaction_date: string
  txn_type: string
  account_id: number | null
  amount: string
  direction: "in" | "out" | string
  payment_method: string | null
  project_id: number | null
  description: string | null
  ref_type: string | null
  ref_id: number | null
  created_by: number | null
  deleted_at: string | null
  created_at: string
  account_name?: string | null
  project_name?: string | null
}

export interface CashBookEntry {
  id: number
  entry_date: string
  transaction_id: string
  income_amount: string
  expense_amount: string
  balance: string
  account_id: number | null
  payment_method: string | null
  project_id: number | null
  description: string | null
  entry_type: string
  ref_type: string | null
  ref_id: number | null
  ledger_scope?: LedgerScope | string
  created_at: string
  account_name?: string | null
  project_name?: string | null
  project_code?: string | null
}

export interface ProjectLedgerEntry {
  id: number
  project_id: number
  entry_date: string
  transaction_id: string
  income_amount: string
  expense_amount: string
  balance: string
  payment_method: string | null
  description: string | null
  entry_type: string
  ref_type: string | null
  ref_id: number | null
  created_at: string
  project_name?: string | null
  project_code?: string | null
}

export interface ProjectBudget {
  id: number
  project_id: number
  category: string
  estimated_amount: string
  notes: string | null
  created_by: number | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  spent_amount?: string
  project_name?: string | null
  project_code?: string | null
}

export interface SalaryPayroll {
  id: number
  payslip_number: string
  staff_id: number
  pay_period: string
  pay_date: string
  basic_salary: string
  allowances: string
  bonus: string
  overtime: string
  deductions: string
  net_salary: string
  payment_method: string | null
  account_id: number | null
  status: SalaryStatus | string
  notes: string | null
  paid_at: string | null
  created_by: number | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  staff_name?: string | null
  account_name?: string | null
}

export interface ProjectFinanceSummary {
  id?: number
  project_id: number
  project_value: string
  total_income: string
  total_expense: string
  total_budget?: string
  advance_received: string
  balance_amount: string
  net_profit: string
  profit_percent: string
  budget_used_percent?: string
  updated_at?: string
  project_name?: string
  project_code?: string
  client_name?: string | null
}

export interface ApprovalLog {
  id: number
  entity_type: string
  entity_id: number
  action: string
  from_status: string | null
  to_status: string | null
  user_id: number | null
  comment: string | null
  created_at: string
  user_name?: string | null
}

export interface FinanceNotification {
  id: number
  user_id: number
  type: string
  title: string
  message: string | null
  entity_type: string | null
  entity_id: number | null
  read: boolean
  created_at: string
}

export interface FinanceDashboardOverview {
  todayIncome: number
  todayExpense: number
  monthlyIncome: number
  monthlyExpense: number
  cashBalance: number
  bankBalance: number
  outstandingReceivables: number
  outstandingPayables: number
  netProfit: number
  pendingApprovals: number
  upcomingPayments: number
}

export interface FinanceChartPoint {
  label: string
  income?: number
  expense?: number
  profit?: number
  amount?: number
  name?: string
  value?: number
  color?: string
}

export interface FinanceReportFilters {
  from?: string
  to?: string
  clientId?: number
  projectId?: number
  vendorId?: number
  staffId?: number
  categoryId?: number
  paymentMethod?: string
  period?: "daily" | "weekly" | "monthly" | "yearly"
}
