import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { homePathForRole } from "@/lib/constants"

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  redirect(homePathForRole(user.role))
}