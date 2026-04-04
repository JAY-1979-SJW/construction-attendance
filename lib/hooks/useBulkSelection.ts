'use client'
import { useState } from 'react'

/**
 * 관리자 화면 대량 처리용 선택 상태 관리 hook.
 * presence-checks / work-confirmations / attendance 등 bulk 기능이 있는 페이지에서 공통 사용.
 */
export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  /** 단일 항목 토글 */
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  /** 전체 선택 해제 */
  const clearSelection = () => setSelectedIds(new Set())

  /**
   * 전달된 ids 전체 선택 / 전체 해제 토글.
   * 이미 모두 선택된 상태면 해제, 아니면 전체 선택.
   */
  const toggleSelectAll = (ids: string[]) => {
    const allSelected = ids.length > 0 && ids.every(id => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(ids))
  }

  return { selectedIds, toggleSelect, clearSelection, toggleSelectAll }
}
