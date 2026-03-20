export interface ApiSuccess<T = unknown> {
  success: true
  data: T
  message?: string
}

export interface ApiError {
  success: false
  message: string
  code?: string
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

// Pagination
export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
