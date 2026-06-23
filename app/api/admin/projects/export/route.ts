import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { logAudit } from "@/lib/project-access"
import { getAllProjectsForExport } from "@/lib/queries"
import {
  buildProjectsExcelBuffer,
  getProjectsExportFileName,
} from "@/lib/services/projects-export"

export const dynamic = "force-dynamic"

export function OPTIONS() {
  return apiOptionsResponse()
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "Admin") {
      return withApiCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    const projects = await getAllProjectsForExport()
    const buffer = await buildProjectsExcelBuffer(projects)
    const fileName = getProjectsExportFileName()

    await logAudit(user.id, "project.export", "project", 0, { count: projects.length })

    return withApiCors(
      new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      }),
    )
  } catch (error) {
    console.error("[projects/export]", error)
    return withApiCors(
      NextResponse.json({ error: "Failed to export projects." }, { status: 500 }),
    )
  }
}
