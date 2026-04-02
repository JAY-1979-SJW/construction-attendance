'use client'

import { PageShell, PageHeader } from '@/components/admin/ui'

export default function WorkOrdersPage() {
  return (
    <PageShell>
      <PageHeader
        title="작업지시"
        description="작업지시서 생성 및 관리"
      />
      <div className="bg-card rounded-[12px] border border-brand px-8 py-16 text-center">
        <div className="text-[32px] mb-3">🚧</div>
        <div className="text-[16px] font-semibold text-title-brand mb-2">준비 중</div>
        <div className="text-[13px] text-muted-brand">작업지시 기능은 현재 개발 중입니다.</div>
      </div>
    </PageShell>
  )
}
