import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { updateOfficeProfileLogo } from "@/lib/queries"
import { logAudit } from "@/lib/project-access"

export const dynamic = "force-dynamic"

const MAX_BYTES = 512 * 1024

export function OPTIONS() {
  return apiOptionsResponse()
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "Admin") {
      return withApiCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    const formData = await request.formData()
    const file = formData.get("logo")
    if (!file || !(file instanceof File)) {
      return withApiCors(NextResponse.json({ error: "No logo file provided." }, { status: 400 }))
    }

    if (!file.type.startsWith("image/")) {
      return withApiCors(NextResponse.json({ error: "Logo must be an image file." }, { status: 400 }))
    }

    const bytes = await file.arrayBuffer()
    if (bytes.byteLength > MAX_BYTES) {
      return withApiCors(
        NextResponse.json(
          { error: "Logo is too large. Use a smaller image (max 500KB)." },
          { status: 400 },
        ),
      )
    }

    const ext = file.type === "image/png" ? "png" : "jpg"
    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    await mkdir(uploadsDir, { recursive: true })

    const fileName = `company-logo.${ext}`
    await writeFile(path.join(uploadsDir, fileName), Buffer.from(bytes))

    const publicPath = `/uploads/${fileName}`
    await updateOfficeProfileLogo(publicPath)
    await logAudit(user.id, "settings.logo_upload", "settings", 0, { path: publicPath })
    revalidatePath("/admin/settings")
    revalidatePath("/admin/invoices")

    return withApiCors(NextResponse.json({ path: publicPath }))
  } catch (error) {
    console.error("[settings/logo]", error)
    return withApiCors(NextResponse.json({ error: "Failed to upload logo." }, { status: 500 }))
  }
}
