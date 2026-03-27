'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  PageShell, SectionCard, PageHeader,
  FilterInput, FilterSelect, FilterPill,
  AdminTable, AdminTr, AdminTd, EmptyRow,
  StatusBadge, Btn,
} from '@/components/admin/ui'

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface ReportItem {
  id: string
  workerId: string
  siteId: string
  reportDate: string
  tradeFamilyLabel: string | null
  tradeLabel: string | null
  taskLabel: string | null
  workDetail: string | null
  buildingName: string | null
  floorLabel: string | null
  locationDetail: string | null
  locationDisplayName: string | null
  yesterdayWork: string | null
  todayWork: string | null
  tomorrowWork: string | null
  workStartTime: string | null
  workEndTime: string | null
  consecutiveDays: number
  todayManDays: number
  monthlyManDays: number
  totalManDays: number
  notes: string | null
  photos: string[]
  employmentType: string
  jobTitle: string
  status: string
  confirmedAt: string | null
  adminMemo: string | null
  worker: { id: string; name: string; phone: string; jobTitle: string }
  site: { id: string; name: string }
}

interface MissingItem {
  workerId: string
  workerName: string
  workerPhone: string
  jobTitle: string
  siteId: string
  siteName: string
  checkInAt: string | null
  attendanceStatus: string
}

interface Summary {
  totalAttendance: number
  totalReports: number
  confirmedCount: number
  writtenCount: number
  missingCount: number
}

// ── 상수 ──────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'WRITTEN', label: '작성완료' },
  { value: 'CONFIRMED', label: '확인완료' },
  { value: 'MISSING', label: '미작성' },
]

const EMP_OPTIONS = [
  { value: '', label: '전체 고용형태' },
  { value: 'DIRECT', label: '직영' },
  { value: 'DAILY', label: '일용' },
  { value: 'OUTSOURCE_LEAD', label: '외주팀장' },
  { value: 'OUTSOURCE_CREW', label: '외주팀원' },
]

const EMP_LABEL: Record<string, string> = {
  DIRECT: '직영', DAILY: '일용', OUTSOURCE_LEAD: '외주팀장', OUTSOURCE_CREW: '외주팀원',
}

function toKST(date: string | null) {
  if (!date) return '-'
  return new Date(new Date(date).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(11, 16)
}

// ── 본문 ──────────────────────────────────────────────────────────────────────

function ReportsPageInner() {
  const searchParams = useSearchParams()
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // 필터
  const [date, setDate] = useState(searchParams.get('date') || todayStr)
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [empType, setEmpType] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // 데이터
  const [items, setItems] = useState<ReportItem[]>([])
  const [missing, setMissing] = useState<MissingItem[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  // 상세
  const [selected, setSelected] = useState<ReportItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [adminMemo, setAdminMemo] = useState('')
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null)

  // ── 데이터 로딩 ────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ date, page: String(page), pageSize: '30' })
      if (status) params.set('status', status)
      if (empType) params.set('employmentType', empType)
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/daily-reports?${params}`)
      const data = await res.json()
      if (data.success) {
        setItems(data.data.items || [])
        setTotal(data.data.total || 0)
        setSummary(data.data.summary || null)
        setMissing(data.data.missing || [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [date, status, empType, search, page])

  useEffect(() => { fetchData() }, [fetchData])

  // ── 확인완료 처리 ──────────────────────────────────────────

  const handleConfirm = async (id: string) => {
    const res = await fetch(`/api/admin/daily-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONFIRMED', adminMemo: adminMemo || null }),
    })
    const data = await res.json()
    if (data.success) { setSelected(data.data); fetchData() }
  }

  const handleRevert = async (id: string) => {
    const res = await fetch(`/api/admin/daily-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'WRITTEN', adminMemo: adminMemo || null }),
    })
    const data = await res.json()
    if (data.success) { setSelected(data.data); fetchData() }
  }

  const openDetail = (item: ReportItem) => {
    setSelected(item); setAdminMemo(item.adminMemo || ''); setDetailOpen(true)
  }

  const showMissing = status === 'MISSING'

  return (
    <PageShell>

      <PageHeader
        title="작업일보 관리"
        description="근로자 작업일보를 확인하고 관리합니다"
        actions={<Btn variant="ghost" size="sm" onClick={fetchData}>새로고침</Btn>}
      />

      {/* ── KPI ────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          {[
            { label: '출근 인원', value: summary.totalAttendance, color: '#6B7280' },
            { label: '일보 작성', value: summary.totalReports, color: '#3B82F6' },
            { label: '확인완료', value: summary.confirmedCount, color: '#22C55E' },
            { label: '미확인', value: summary.writtenCount, color: '#F97316' },
            { label: '미작성', value: summary.missingCount, color: '#EF4444' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl p-3 text-center border border-[#F3F4F6]">
              <div className="text-[11px] text-[#9CA3AF] mb-1">{kpi.label}</div>
              <div className="text-[20px] font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── 필터 ───────────────────────────────────────── */}
      <SectionCard>
        <div className="flex flex-wrap gap-3 items-center">
          <FilterInput type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1) }} className="w-[150px]" />
          <FilterSelect value={empType} onChange={(e) => { setEmpType(e.target.value); setPage(1) }}>
            {EMP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </FilterSelect>
          <FilterInput type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="이름 검색" className="w-[120px]" />
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <FilterPill key={opt.value} active={status === opt.value}
              onClick={() => { setStatus(opt.value); setPage(1) }}>
              {opt.label}
              {opt.value === 'MISSING' && summary ? ` (${summary.missingCount})` : ''}
            </FilterPill>
          ))}
          <span className="text-[12px] text-[#6B7280] ml-1">총 {total}건</span>
        </div>
      </SectionCard>

      {/* ── 미작성 목록 ────────────────────────────────── */}
      {showMissing && (
        <SectionCard className="mt-4">
          <div className="text-[14px] font-semibold text-[#EF4444] mb-3">미작성 근로자 ({missing.length}명)</div>
          {missing.length === 0 ? (
            <div className="text-[13px] text-[#9CA3AF] py-4 text-center">미작성 인원이 없습니다.</div>
          ) : (
            <AdminTable headers={['근로자', '현장', '직종', '출근시각', '상태']}>
              {missing.map((m) => (
                <AdminTr key={m.workerId} highlighted>
                  <AdminTd className="font-medium text-[#0F172A]">{m.workerName}</AdminTd>
                  <AdminTd>{m.siteName}</AdminTd>
                  <AdminTd>{m.jobTitle}</AdminTd>
                  <AdminTd>{toKST(m.checkInAt)}</AdminTd>
                  <AdminTd><StatusBadge status="REJECTED" label="미작성" /></AdminTd>
                </AdminTr>
              ))}
            </AdminTable>
          )}
        </SectionCard>
      )}

      {/* ── 작업일보 목록 ──────────────────────────────── */}
      {!showMissing && (
        <SectionCard className="mt-4">
          {loading ? (
            <div className="text-[13px] text-[#9CA3AF] py-8 text-center">로딩 중...</div>
          ) : items.length === 0 ? (
            <AdminTable headers={['작업일자', '근로자', '직종', '현장', '근무시간', '공종/작업사항', '사진', '상태']}>
              <EmptyRow colSpan={8} message="작업일보가 없습니다." />
            </AdminTable>
          ) : (
            <>
              <AdminTable headers={['작업일자', '근로자', '직종', '현장', '근무시간', '공종/작업사항', '사진', '상태']}>
                {items.map((item) => (
                  <AdminTr key={item.id} onClick={() => openDetail(item)}
                    className={
                      detailOpen && selected?.id === item.id
                        ? 'bg-[#FFF7ED] hover:bg-[#FFF7ED]'
                        : item.status === 'CONFIRMED'
                          ? 'bg-[#FAFFFE] hover:bg-[#F0FDF4]'
                          : ''
                    }>
                    <AdminTd className="text-[#6B7280] text-[12px]">{item.reportDate?.slice(5, 10)}</AdminTd>
                    <AdminTd className="text-[#0F172A] font-medium">{item.worker.name}</AdminTd>
                    <AdminTd className="text-[#6B7280] text-[12px]">{item.jobTitle || '-'}</AdminTd>
                    <AdminTd className="text-[#6B7280] text-[12px] max-w-[120px] truncate">{item.site.name}</AdminTd>
                    <AdminTd className="text-[#6B7280] text-[12px]">
                      {item.workStartTime && item.workEndTime
                        ? `${item.workStartTime}~${item.workEndTime}`
                        : item.workStartTime || item.workEndTime || '-'}
                    </AdminTd>
                    <AdminTd className="max-w-[200px]">
                      <div className="line-clamp-1 text-[12px]">
                        {[item.tradeFamilyLabel, item.tradeLabel, item.taskLabel].filter(Boolean).join(' > ') || '-'}
                      </div>
                    </AdminTd>
                    <AdminTd className="text-center">
                      {item.photos && item.photos.length > 0 ? (
                        <span className="text-[11px] text-[#3B82F6]">{item.photos.length}장</span>
                      ) : (
                        <span className="text-[11px] text-[#D1D5DB]">-</span>
                      )}
                    </AdminTd>
                    <AdminTd className="text-center">
                      <StatusBadge status={item.status} />
                    </AdminTd>
                  </AdminTr>
                ))}
              </AdminTable>

              {total > 30 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Btn size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</Btn>
                  <span className="text-[12px] text-[#6B7280] py-1.5 px-2">{page} / {Math.ceil(total / 30)}</span>
                  <Btn size="sm" variant="secondary" disabled={page >= Math.ceil(total / 30)} onClick={() => setPage((p) => p + 1)}>다음</Btn>
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}

      {/* ── 상세 패널 ──────────────────────────────────── */}
      {detailOpen && selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setDetailOpen(false)} />
          <div className="fixed top-0 right-0 h-screen w-[460px] bg-white z-50 flex flex-col shadow-xl">
            <div className="h-1 bg-[#F97316]" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#F3F4F6]">
              <div>
                <div className="text-[15px] font-bold text-[#0F172A]">{selected.worker.name} 작업일보</div>
                <div className="text-[12px] text-[#9CA3AF]">{selected.site.name} · {selected.reportDate?.slice(0, 10)}</div>
              </div>
              <button onClick={() => setDetailOpen(false)} className="text-[#9CA3AF] hover:text-[#374151] text-[18px]">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 근로자 기본정보 */}
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <InfoCell label="근로자" value={selected.worker.name} />
                <InfoCell label="직종" value={selected.jobTitle} />
                <InfoCell label="현장" value={selected.site.name} />
                <InfoCell label="작업일자" value={selected.reportDate?.slice(0, 10)} />
              </div>

              {/* 근무시간 */}
              {(selected.workStartTime || selected.workEndTime) && (
                <InfoCell label="근무시간" value={`${selected.workStartTime || ''} ~ ${selected.workEndTime || ''}`} />
              )}

              {/* 공종/작업사항 */}
              <div className="bg-[#F9FAFB] rounded-xl p-3 text-[13px]">
                <div className="text-[11px] text-[#9CA3AF] mb-1">공종 / 작업사항</div>
                {(selected.tradeFamilyLabel || selected.tradeLabel || selected.taskLabel) ? (
                  <div className="text-[#374151] whitespace-pre-wrap">
                    {[selected.tradeFamilyLabel, selected.tradeLabel, selected.taskLabel].filter(Boolean).join(' > ')}
                  </div>
                ) : (
                  <div className="text-[#9CA3AF]">-</div>
                )}
                {selected.workDetail && (
                  <div className="text-[#6B7280] mt-1.5 text-[12px] whitespace-pre-wrap">{selected.workDetail}</div>
                )}
              </div>

              {/* 특이사항 */}
              {selected.notes && (
                <div>
                  <div className="text-[12px] font-semibold text-[#374151] mb-1">특이사항</div>
                  <div className="text-[13px] text-[#6B7280] bg-[#F9FAFB] rounded-xl p-3 whitespace-pre-wrap">{selected.notes}</div>
                </div>
              )}

              {/* 첨부 사진 */}
              <div>
                <div className="text-[12px] font-semibold text-[#374151] mb-2">첨부 사진</div>
                {selected.photos && selected.photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {selected.photos.map((p, i) => (
                      <button key={i} onClick={() => setPreviewPhoto(p)}
                        className="aspect-square rounded-xl overflow-hidden border border-[#E5E7EB] hover:border-[#F97316] transition-colors">
                        <img
                          src={`/api/admin/daily-reports/photos/file?path=${encodeURIComponent(p)}`}
                          alt={`사진 ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[13px] text-[#9CA3AF] bg-[#F9FAFB] rounded-xl p-3">첨부 사진 없음</div>
                )}
              </div>

              {/* 관리자 메모 */}
              <div>
                <div className="text-[12px] font-semibold text-[#374151] mb-1">관리자 메모</div>
                <textarea value={adminMemo} onChange={(e) => setAdminMemo(e.target.value)} rows={2}
                  className="w-full text-[13px] border border-[#E5E7EB] rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316] resize-none"
                  placeholder="메모를 입력하세요" />
              </div>

              {/* 확인 상태 */}
              <div className="flex items-center gap-2">
                <StatusBadge status={selected.status} />
                {selected.confirmedAt && (
                  <span className="text-[11px] text-[#9CA3AF]">{new Date(selected.confirmedAt).toLocaleString('ko-KR')}</span>
                )}
              </div>
            </div>

            {/* 하단 액션 */}
            <div className="px-5 py-3 border-t border-[#E5E7EB] flex gap-2">
              {selected.status !== 'CONFIRMED' ? (
                <Btn variant="orange" className="flex-1" onClick={() => handleConfirm(selected.id)}>확인완료 처리</Btn>
              ) : (
                <Btn variant="secondary" className="flex-1" onClick={() => handleRevert(selected.id)}>확인 취소</Btn>
              )}
              <Btn variant="secondary" onClick={() => setDetailOpen(false)}>닫기</Btn>
            </div>
          </div>
        </>
      )}

      {/* ── 사진 확대 모달 ────────────────────────────────── */}
      {previewPhoto && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[60]" onClick={() => setPreviewPhoto(null)} />
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-8" onClick={() => setPreviewPhoto(null)}>
            <img
              src={`/api/admin/daily-reports/photos/file?path=${encodeURIComponent(previewPhoto)}`}
              alt="사진 확대"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-black/50 rounded-full text-white flex items-center justify-center text-[16px] hover:bg-black/70">
              ✕
            </button>
          </div>
        </>
      )}
    </PageShell>
  )
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function InfoCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-[#9CA3AF]">{label}</div>
      <div className={highlight ? 'text-[#F97316] font-medium' : 'text-[#374151]'}>{value}</div>
    </div>
  )
}

function ManDayCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="flex-1 rounded-lg p-3 text-center" style={{ background: bg }}>
      <div className="text-[11px] text-[#9CA3AF]">{label}</div>
      <div className="text-[18px] font-bold" style={{ color }}>{value}</div>
    </div>
  )
}

function WorkSection({ label, text, highlight }: { label: string; text: string | null; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-[#374151] mb-1">{label}</div>
      <div className={`text-[13px] rounded-lg p-3 min-h-[40px] whitespace-pre-wrap ${
        highlight ? 'text-[#374151] bg-[#FFF7ED]' : 'text-[#6B7280] bg-[#F9FAFB]'
      }`}>
        {text || '-'}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  return <Suspense><ReportsPageInner /></Suspense>
}
