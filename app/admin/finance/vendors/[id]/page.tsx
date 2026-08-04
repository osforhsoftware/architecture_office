import { redirect } from "next/navigation"

export default async function LegacyVendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/finance/office/vendors/${id}`)
}
