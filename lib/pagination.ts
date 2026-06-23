export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, "all"] as const

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

export interface PaginatedResult<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginationParams {
  page?: string
  pageSize?: string
  search?: string
}

export function getDefaultPageSize(): number {
  const raw = process.env.TABLE_PAGE_SIZE ?? process.env.DEFAULT_PAGE_SIZE ?? "10"
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
}

export function parsePageSize(value?: string): number {
  if (value === "all") return -1
  if (value) {
    const parsed = Number.parseInt(value, 10)
    if ([10, 25, 50, 100].includes(parsed)) return parsed
  }
  return getDefaultPageSize()
}

export function parsePage(value?: string): number {
  const parsed = Number.parseInt(value ?? "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function buildTotalPages(total: number, pageSize: number): number {
  if (pageSize === -1) return 1
  if (total === 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Clamp page to valid range after count is known (avoids empty pages after search/filter). */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(page, buildTotalPages(total, pageSize))
}

export function pageOffset(page: number, pageSize: number): number {
  return pageSize === -1 ? 0 : (page - 1) * pageSize
}

export function resolvePagination(params: PaginationParams) {
  const pageSize = parsePageSize(params.pageSize)
  const page = parsePage(params.page)
  const totalPagesPlaceholder = 1
  const offset = pageSize === -1 ? 0 : (page - 1) * pageSize
  const limit = pageSize === -1 ? null : pageSize

  return { page, pageSize, offset, limit, totalPagesPlaceholder }
}

export function toPaginatedResult<T>(
  rows: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const totalPages = buildTotalPages(total, pageSize)

  return {
    rows,
    total,
    page: clampPage(page, total, pageSize),
    pageSize,
    totalPages,
  }
}

export function buildSearchPattern(search?: string): string | null {
  const trimmed = search?.trim()
  return trimmed ? `%${trimmed}%` : null
}
