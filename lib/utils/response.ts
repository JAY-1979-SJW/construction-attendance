import { NextResponse } from 'next/server'
import type { ApiSuccess, ApiError } from '@/types/api'

export function ok<T>(data: T, message?: string, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data, message }, { status })
}

export function created<T>(data: T, message?: string): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data, message }, { status: 201 })
}

export function badRequest(message: string, code?: string): NextResponse<ApiError> {
  return NextResponse.json({ success: false, message, code }, { status: 400 })
}

export function unauthorized(message = '인증이 필요합니다.'): NextResponse<ApiError> {
  return NextResponse.json({ success: false, message }, { status: 401 })
}

export function forbidden(message = '권한이 없습니다.'): NextResponse<ApiError> {
  return NextResponse.json({ success: false, message }, { status: 403 })
}

export function notFound(message = '데이터를 찾을 수 없습니다.'): NextResponse<ApiError> {
  return NextResponse.json({ success: false, message }, { status: 404 })
}

export function conflict(message: string): NextResponse<ApiError> {
  return NextResponse.json({ success: false, message }, { status: 409 })
}

export function internalError(message = '서버 오류가 발생했습니다.'): NextResponse<ApiError> {
  return NextResponse.json({ success: false, message }, { status: 500 })
}
