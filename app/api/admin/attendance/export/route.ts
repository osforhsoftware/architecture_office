import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { isSuperAdmin } from "@/lib/constants"
import { logAudit } from "@/lib/project-access"
import {
  buildAttendanceCsv,
  buildAttendanceExcelBuffer,
  getAttendanceExportFileName,
  getAttendanceExportRows,
  todayInOfficeTz,
} from "@/lib/attendance"

export const dynamic = "force-dynamic"

export function OPTIONS() {
  return apiOptionsResponse()
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || !isSuperAdmin(user.role)) {
      return withApiCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") === "csv" ? "csv" : "xlsx"
    const hasMonth = Boolean(searchParams.get("month"))
    const date =
      searchParams.get("date") ??
      (hasMonth || searchParams.get("from") || searchParams.get("to")
        ? undefined
        : todayInOfficeTz())

    const rows = await getAttendanceExportRows({
      search: searchParams.get("search") ?? undefined,
      staffId: searchParams.get("staffId") ?? undefined,
      department: searchParams.get("department") ?? undefined,
      date,
      month: searchParams.get("month") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      includeAbsent: !hasMonth && !searchParams.get("from") && !searchParams.get("to"),
    })

    await logAudit(user.id, "attendance.export", "attendance", 0, {
      format,
      rows: rows.length,
    })

    if (format === "csv") {
      const csv = buildAttendanceCsv(rows)
      const fileName = getAttendanceExportFileName("csv")
      return withApiCors(
        new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "no-store",
          },
        }),
      )
    }

    const buffer = await buildAttendanceExcelBuffer(rows)
    const fileName = getAttendanceExportFileName("xlsx")
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
    console.error("[attendance.export]", error)
    return withApiCors(
      NextResponse.json({ error: "Export failed" }, { status: 500 }),
    )
  }
}
