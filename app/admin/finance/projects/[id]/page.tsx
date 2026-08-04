import { redirect } from "next/navigation"

export default async function LegacyProjectFinanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/finance/project/${id}`)
}
