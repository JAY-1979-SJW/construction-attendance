'use client'

import { useState, useEffect } from 'react'

/**
 * 현재 로그인한 관리자의 role을 반환합니다.
 * 로딩 중 또는 미인증 시 null 반환.
 * - VIEWER: GET 조회만 가능
 * - ADMIN: 일반 운영 변경 가능
 * - SUPER_ADMIN: 전체 관리자 포함 모든 기능
 */
export function useAdminRole(): string | null {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setRole(data.data.role)
      })
      .catch(() => {})
  }, [])

  return role
}
