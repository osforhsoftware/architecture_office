import { redirect } from "next/navigation"

export default function LegacyFinanceSettingsPage() {
  redirect("/admin/finance/office/settings")
}
