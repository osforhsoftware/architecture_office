import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { isSuperAdmin } from "@/lib/constants"
import { getOfficeProfile, persistOfficeProfile } from "@/lib/queries"
import { logAudit } from "@/lib/project-access"

export const dynamic = "force-dynamic"

const MAX_BYTES = 512 * 1024
const KINDS = ["logo", "qr", "signature"] as const
type AssetKind = (typeof KINDS)[number]

export function OPTIONS() {
  return apiOptionsResponse()
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || !isSuperAdmin(user.role)) {
      return withApiCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    }

    const formData = await request.formData()
    const kindRaw = String(formData.get("kind") || "logo").trim() as AssetKind
    const kind: AssetKind = KINDS.includes(kindRaw) ? kindRaw : "logo"
    const file = formData.get(kind === "logo" ? "logo" : "file") ?? formData.get("logo")
    if (!file || !(file instanceof File)) {
      return withApiCors(NextResponse.json({ error: "No image file provided." }, { status: 400 }))
    }

    if (!file.type.startsWith("image/")) {
      return withApiCors(NextResponse.json({ error: "File must be an image." }, { status: 400 }))
    }

    const bytes = await file.arrayBuffer()
    if (bytes.byteLength > MAX_BYTES) {
      return withApiCors(
        NextResponse.json(
          { error: "Image is too large. Use a smaller image (max 500KB)." },
          { status: 400 },
        ),
      )
    }

    const ext = file.type === "image/png" ? "png" : "jpg"
    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    await mkdir(uploadsDir, { recursive: true })

    const fileName =
      kind === "logo"
        ? `company-logo.${ext}`
        : kind === "qr"
          ? `payment-qr.${ext}`
          : `architect-signature.${ext}`

    await writeFile(path.join(uploadsDir, fileName), Buffer.from(bytes))
    const publicPath = `/uploads/${fileName}`

    const profile = await getOfficeProfile()
    if (kind === "logo") {
      await persistOfficeProfile({ ...profile, logoDataUrl: publicPath })
    } else if (kind === "qr") {
      await persistOfficeProfile({ ...profile, qrCodeDataUrl: publicPath })
    } else {
      await persistOfficeProfile({ ...profile, signatureDataUrl: publicPath })
    }

    await logAudit(user.id, `settings.${kind}_upload`, "settings", 0, { path: publicPath })
    revalidatePath("/admin/settings")
    revalidatePath("/admin/invoices")

    return withApiCors(NextResponse.json({ path: publicPath, kind }))
  } catch (error) {
    console.error("[settings/logo]", error)
    return withApiCors(NextResponse.json({ error: "Failed to upload image." }, { status: 500 }))
  }
}
