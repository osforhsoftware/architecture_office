import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { userCanAccessAdminPortal } from "@/lib/constants"
import { getProjectAdditionalRequirements } from "@/lib/additional-requirements"
import { resolveOfficeLogoForPdf } from "@/lib/logo-utils"
import { logAudit } from "@/lib/project-access"
import { getClient, getOfficeProfile, getProject } from "@/lib/queries"
import {
  buildProjectPdfBuffer,
  getProjectPdfFileName,
} from "@/lib/services/project-pdf"

export const dynamic = "force-dynamic"

export function OPTIONS() {
  return apiOptionsResponse()
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user || !userCanAccessAdminPortal(user)) {
      return withApiCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    }

    const { id } = await params
    const projectId = Number(id)
    if (!projectId) {
      return withApiCors(NextResponse.json({ error: "Invalid project." }, { status: 400 }))
    }

    const [project, profile, additionalRequirements] = await Promise.all([
      getProject(projectId),
      getOfficeProfile(),
      getProjectAdditionalRequirements(projectId),
    ])

    if (!project) {
      return withApiCors(NextResponse.json({ error: "Project not found." }, { status: 404 }))
    }

    const client = await getClient(project.client_id)
    const profileWithLogo = await resolveOfficeLogoForPdf(profile)
    const buffer = buildProjectPdfBuffer(project, client, profileWithLogo, additionalRequirements)
    const fileName = getProjectPdfFileName(project.code)

    await logAudit(user.id, "project.pdf_export", "project", projectId, {})

    return withApiCors(
      new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      }),
    )
  } catch (error) {
    console.error("[projects/pdf]", error)
    return withApiCors(
      NextResponse.json({ error: "Failed to generate PDF." }, { status: 500 }),
    )
  }
}
