const MAX_PAGE_SIZE = 500

/** Parses a page number string, clamping to minimum 1. Handles NaN and negative values. */
export function parsePage(value: string | null, defaultValue = 1): number {
  const raw = parseInt(value ?? String(defaultValue), 10)
  return Math.max(1, isNaN(raw) ? defaultValue : raw)
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { page?: number; pageSize?: number } = {},
): { page: number; pageSize: number } {
  const defaultPage = defaults.page ?? 1
  const defaultPageSize = defaults.pageSize ?? 20

  const rawPage = parseInt(searchParams.get('page') ?? String(defaultPage), 10)
  const rawPageSize = parseInt(searchParams.get('pageSize') ?? String(defaultPageSize), 10)

  const page = Math.max(1, isNaN(rawPage) ? defaultPage : rawPage)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, isNaN(rawPageSize) ? defaultPageSize : rawPageSize))

  return { page, pageSize }
}
