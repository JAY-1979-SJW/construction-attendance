const MAX_PAGE_SIZE = 500

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
