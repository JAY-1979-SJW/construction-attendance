'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── 타입 ─────────────────────────────────────────────────

interface TempDoc {
  id: string
  workerId: string
  workerName?: string
  documentType: string
  purpose: string
  fileName: string
  fileSize: number
  mimeType: string
  expiresAt: string
  downloadedAt: string | null
  deleteScheduledAt: string | null
  deletedAt: string | null
  deleteReason: string | null
  uploadedBy: string
  uploadedAt: string
}

// ─── 유틸 ─────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtSize(bytes: number) {
  if (bytes < 1024)      return `${bytes} B`
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1024/1024).toFixed(1)} MB`
}

function docStatus(doc: TempDoc): { label: string; color: string } {
  if (doc.deletedAt) return { label: '삭제됨', color: 'bg-gray-200 text-gray-500' }
  const now = new Date()
  if (new Date(doc.expiresAt) < now) return { label: '만료', color: 'bg-red-100 text-red-600' }
  if (doc.deleteScheduledAt && new Date(doc.deleteScheduledAt) < now)
    return { label: '삭제 예정', color: 'bg-orange-100 text-orange-700' }
  if (doc.downloadedAt) return { label: '다운로드됨', color: 'bg-blue-100 text-blue-700' }
  return { label: '보관 중', color: 'bg-green-100 text-green-700' }
}

// ─── 메인 컴포넌트 ────────────────────────────────────────

export default function TempDocsPage() {
  // 이 페이지는 근로자별 임시 서류를 관리하는 통합 뷰
  // 실제 운영에서는 근로자 상세 페이지 내 탭으로 접근하는 것을 권장

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">임시 민감 서류 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          근로자별 임시 서류는 해당 근로자 상세 페이지의 <strong>민감정보</strong> 탭에서 관리합니다.
        </p>
      </div>

      <div className="border rounded-xl p-6 bg-orange-50 space-y-3">
        <h2 className="font-bold text-orange-800">⚠ 임시 서류 보관 정책</h2>
        <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
          <li>업로드 후 <strong>최대 5일</strong> 보관 후 자동 삭제</li>
          <li>최초 다운로드 후 <strong>24시간</strong> 경과 시 자동 삭제</li>
          <li>다운로드 시 <strong>사유 입력 필수</strong> (5자 이상), 감사로그 기록</li>
          <li>신분증 파일은 이 시스템에 저장하지 않습니다 (확인 결과 텍스트만 저장)</li>
          <li>자동 삭제 스케줄러: <code className="bg-orange-100 px-1 rounded">/api/cron/cleanup-temp-docs</code> (매시 정각)</li>
        </ul>
      </div>

      <div className="border rounded-xl p-6 bg-gray-50 space-y-2">
        <h2 className="font-semibold">근로자별 서류 접근 방법</h2>
        <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
          <li>관리자 메뉴 → 근로자 관리 → 근로자 검색</li>
          <li>근로자 상세 페이지 이동</li>
          <li><strong>민감정보</strong> 탭 → <strong>임시 서류</strong> 섹션에서 업로드/다운로드/삭제</li>
        </ol>
      </div>

      <div className="border rounded-xl p-6 bg-blue-50 space-y-2">
        <h2 className="font-semibold text-blue-900">스케줄러 상태 확인</h2>
        <p className="text-sm text-blue-700">
          서버 관리자는 아래 엔드포인트로 자동 삭제 스케줄러를 수동 실행하거나 상태를 확인할 수 있습니다.
        </p>
        <code className="block text-xs bg-blue-100 px-3 py-2 rounded">
          GET /api/cron/cleanup-temp-docs<br />
          Authorization: Bearer {'{'}{'{'}CRON_SECRET{'}'}{'}'}
        </code>
        <p className="text-xs text-blue-600">
          crontab 설정: <code>0 * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/cleanup-temp-docs</code>
        </p>
      </div>
    </div>
  )
}
