'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import WorkerTopBar from '@/components/worker/WorkerTopBar'
import WorkerBottomNav from '@/components/worker/WorkerBottomNav'

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface Attendance {
  id: string
  siteId: string
  checkInSite: { id: string; name: string }
  checkInAt: string | null
  status: string
}

interface Report {
  id: string
  siteId: string
  reportDate: string
  tradeFamilyCode: string | null
  tradeFamilyLabel: string | null
  tradeCode: string | null
  tradeLabel: string | null
  taskCode: string | null
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
  employmentType: string
  jobTitle: string
  status: string
  site: { id: string; name: string }
}

interface TradeFamily {
  id: string; code: string; label: string
  trades: { id: string; code: string; label: string }[]
  tasks: { id: string; code: string; label: string; tradeId: string | null }[]
}

interface Suggestion {
  text: string
  tradeFamilyCode: string | null; tradeFamilyLabel: string | null
  tradeCode: string | null; tradeLabel: string | null
  taskCode: string | null; taskLabel: string | null
  workDetail?: string | null
  buildingName?: string | null; floorLabel?: string | null
  locationDetail?: string | null; locationDisplayName?: string | null
  count?: number
}

// ── 고용형태 ──────────────────────────────────────────────────────────────────

const EMP_TYPES = [
  { value: 'DIRECT', label: '직영' },
  { value: 'DAILY', label: '일용' },
  { value: 'OUTSOURCE_LEAD', label: '외주팀장' },
  { value: 'OUTSOURCE_CREW', label: '외주팀원' },
]

// ── 셀렉트 컴포넌트 ──────────────────────────────────────────────────────────

function Sel({ label, value, onChange, options, placeholder }: {
  label: string; value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <div className="flex-1">
      <div className="text-[11px] text-[#9CA3AF] mb-1">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[13px] border border-[#E5E7EB] rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316]"
      >
        <option value="">{placeholder || `${label} 선택`}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function DailyReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // 데이터
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [workerName, setWorkerName] = useState('')
  const [workerJobTitle, setWorkerJobTitle] = useState('')

  // 마스터
  const [families, setFamilies] = useState<TradeFamily[]>([])
  const [buildings, setBuildings] = useState<string[]>([])
  const [floorsByBuilding, setFloorsByBuilding] = useState<Record<string, string[]>>({})
  const [detailsByBF, setDetailsByBF] = useState<Record<string, string[]>>({})

  // 제안
  const [yesterdayReport, setYesterdayReport] = useState<any>(null)
  const [recentItems, setRecentItems] = useState<Suggestion[]>([])
  const [frequentItems, setFrequentItems] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // ── 폼 상태 ────────────────────────────────────────────────
  const [empType, setEmpType] = useState('DIRECT')
  const [todayManDays, setTodayManDays] = useState(1.0)
  // 공종/작업사항
  const [familyCode, setFamilyCode] = useState('')
  const [tradeCode, setTradeCode] = useState('')
  const [taskCode, setTaskCode] = useState('')
  const [workDetail, setWorkDetail] = useState('')
  // 위치
  const [building, setBuilding] = useState('')
  const [floor, setFloor] = useState('')
  const [locDetail, setLocDetail] = useState('')
  // 작업 3구조
  const [yesterdayWork, setYesterdayWork] = useState('')
  const [todayWork, setTodayWork] = useState('')
  const [tomorrowWork, setTomorrowWork] = useState('')
  // 기타
  const [workStart, setWorkStart] = useState('')
  const [workEnd, setWorkEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [materialUsed, setMaterialUsed] = useState(false)
  const [materialNote, setMaterialNote] = useState('')

  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // ── 파생 데이터 ────────────────────────────────────────────

  const selectedFamily = families.find((f) => f.code === familyCode)
  const tradeOptions = selectedFamily?.trades.map((t) => ({ value: t.code, label: t.label })) || []
  const taskOptions = (selectedFamily?.tasks || [])
    .filter((t) => !t.tradeId || t.tradeId === families.find(f => f.code === familyCode)?.trades.find(tr => tr.code === tradeCode)?.id)
    .map((t) => ({ value: t.code, label: t.label }))
  const floorOptions = (floorsByBuilding[building] || []).map((f) => ({ value: f, label: f }))
  const detailOptions = (detailsByBF[`${building}__${floor}`] || []).map((d) => ({ value: d, label: d }))

  // ── 초기 로딩 ──────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch(`/api/worker/daily-reports?date=${todayStr}`).then((r) => r.json()),
      fetch('/api/worker/trades').then((r) => r.json()),
    ]).then(([meData, reportData, tradesData]) => {
      if (!meData.success) { router.push('/login'); return }
      setWorkerName(meData.data.name)
      setWorkerJobTitle(meData.data.jobTitle || '미설정')

      if (tradesData.success) setFamilies(tradesData.data)

      if (reportData.success) {
        const { report: rpt, attendance: att } = reportData.data
        setAttendance(att)

        if (rpt) {
          setReport(rpt)
          setFamilyCode(rpt.tradeFamilyCode || '')
          setTradeCode(rpt.tradeCode || '')
          setTaskCode(rpt.taskCode || '')
          setWorkDetail(rpt.workDetail || '')
          setBuilding(rpt.buildingName || '')
          setFloor(rpt.floorLabel || '')
          setLocDetail(rpt.locationDetail || '')
          setYesterdayWork(rpt.yesterdayWork || '')
          setTodayWork(rpt.todayWork || '')
          setTomorrowWork(rpt.tomorrowWork || '')
          setWorkStart(rpt.workStartTime || '')
          setWorkEnd(rpt.workEndTime || '')
          setNotes(rpt.notes || '')
          setEmpType(rpt.employmentType || 'DIRECT')
          setTodayManDays(Number(rpt.todayManDays) || 1.0)
        }

        // 위치 + 제안 로딩
        if (att) {
          fetch(`/api/worker/locations?siteId=${att.checkInSite.id}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success) {
                setBuildings(d.data.buildings || [])
                setFloorsByBuilding(d.data.floorsByBuilding || {})
                setDetailsByBF(d.data.detailsByBuildingFloor || {})
              }
            }).catch(() => {})

          fetch(`/api/worker/daily-reports/suggestions?siteId=${att.checkInSite.id}&date=${todayStr}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success) {
                setYesterdayReport(d.data.yesterdayReport)
                setRecentItems(d.data.recent || [])
                setFrequentItems(d.data.frequent || [])
              }
            }).catch(() => {})
        }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [router, todayStr])

  // ── 전일 작업 불러오기 ────────────────────────────────────

  const loadYesterday = useCallback(() => {
    if (!yesterdayReport) return
    setYesterdayWork(yesterdayReport.todayWork || '')
    if (yesterdayReport.tradeFamilyCode) setFamilyCode(yesterdayReport.tradeFamilyCode)
    if (yesterdayReport.tradeCode) setTradeCode(yesterdayReport.tradeCode)
    if (yesterdayReport.taskCode) setTaskCode(yesterdayReport.taskCode)
    if (yesterdayReport.workDetail) setWorkDetail(yesterdayReport.workDetail)
    if (yesterdayReport.buildingName) setBuilding(yesterdayReport.buildingName)
    if (yesterdayReport.floorLabel) setFloor(yesterdayReport.floorLabel)
    if (yesterdayReport.locationDetail) setLocDetail(yesterdayReport.locationDetail)
    flash('전일 작업을 불러왔습니다.')
  }, [yesterdayReport])

  const copyToTomorrow = useCallback(() => {
    setTomorrowWork(todayWork)
    flash('금일 작업을 명일로 복사했습니다.')
  }, [todayWork])

  const selectSuggestion = useCallback((item: Suggestion) => {
    if (item.tradeFamilyCode) setFamilyCode(item.tradeFamilyCode)
    if (item.tradeCode) setTradeCode(item.tradeCode)
    if (item.taskCode) setTaskCode(item.taskCode)
    if (item.taskLabel) setTodayWork(item.taskLabel)
    if (item.workDetail) setWorkDetail(item.workDetail)
    if (item.buildingName) setBuilding(item.buildingName)
    if (item.floorLabel) setFloor(item.floorLabel)
    if (item.locationDetail) setLocDetail(item.locationDetail)
    setShowSuggestions(false)
  }, [])

  function flash(m: string) {
    setMsg(m); setTimeout(() => setMsg(''), 2000)
  }

  // ── 저장 ──────────────────────────────────────────────────

  const handleSave = async () => {
    if (!attendance) return
    setSaving(true); setMsg('')

    const selectedTask = selectedFamily?.tasks.find((t) => t.code === taskCode)
    const selectedTrade = selectedFamily?.trades.find((t) => t.code === tradeCode)

    try {
      const res = await fetch('/api/worker/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: attendance.checkInSite.id,
          attendanceLogId: attendance.id,
          reportDate: todayStr,
          employmentType: empType,
          jobTitle: workerJobTitle,
          tradeFamilyCode: familyCode || null,
          tradeFamilyLabel: selectedFamily?.label || null,
          tradeCode: tradeCode || null,
          tradeLabel: selectedTrade?.label || null,
          taskCode: taskCode || null,
          taskLabel: selectedTask?.label || null,
          workDetail: workDetail || null,
          buildingName: building || null,
          floorLabel: floor || null,
          locationDetail: locDetail || null,
          yesterdayWork: yesterdayWork || null,
          todayWork: todayWork || null,
          tomorrowWork: tomorrowWork || null,
          workStartTime: workStart || null,
          workEndTime: workEnd || null,
          todayManDays,
          notes: notes || null,
          materialUsedYn: materialUsed,
          materialNote: materialNote || null,
          copiedFromPreviousYn: false,
        }),
      })
      const data = await res.json()
      if (data.success) { setReport(data.data); flash('저장되었습니다.') }
      else flash(data.message || '저장 실패')
    } catch { flash('네트워크 오류') }
    finally { setSaving(false) }
  }

  // ── 렌더링 ────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
      <div className="text-[#9CA3AF] text-sm">로딩 중...</div>
    </div>
  )

  if (!attendance) return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <WorkerTopBar />
      <div className="pt-14 pb-20 px-4">
        <div className="bg-white rounded-xl p-6 mt-4 text-center">
          <div className="text-[40px] mb-3">📋</div>
          <div className="text-[#374151] font-semibold text-[15px] mb-1">작업일보</div>
          <div className="text-[#9CA3AF] text-[13px]">
            오늘 출근 기록이 없습니다.<br />출근 후 작업일보를 작성할 수 있습니다.
          </div>
        </div>
      </div>
      <WorkerBottomNav />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <WorkerTopBar />
      <div className="pt-14 pb-24 px-4">
        {/* ── 상단 제목 + 기본정보 ───────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[15px] font-bold text-[#0F172A]">오늘 작업일보</span>
            <span className="text-[12px] text-[#9CA3AF]">{todayStr}</span>
          </div>
          <div className="text-[13px] text-[#6B7280] mb-1">
            {attendance.checkInSite.name} · {workerName} · {workerJobTitle}
          </div>
          {/* 고용형태 + 공수 */}
          <div className="flex gap-2 mt-3 mb-2">
            {EMP_TYPES.map((t) => (
              <button key={t.value} onClick={() => setEmpType(t.value)}
                className="flex-1 text-[11px] py-1.5 rounded-lg border transition-colors"
                style={{
                  background: empType === t.value ? '#FFF7ED' : '#fff',
                  borderColor: empType === t.value ? '#F97316' : '#E5E7EB',
                  color: empType === t.value ? '#F97316' : '#6B7280',
                  fontWeight: empType === t.value ? 600 : 400,
                }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="text-[#9CA3AF]">일 공수</span>
            {[0.5, 1.0, 1.5].map((v) => (
              <button key={v} onClick={() => setTodayManDays(v)}
                className="px-3 py-1 rounded-lg border transition-colors"
                style={{
                  background: todayManDays === v ? '#FFF7ED' : '#fff',
                  borderColor: todayManDays === v ? '#F97316' : '#E5E7EB',
                  color: todayManDays === v ? '#F97316' : '#6B7280',
                  fontWeight: todayManDays === v ? 600 : 400,
                }}>
                {v}
              </button>
            ))}
            {report && (
              <span className="ml-auto text-[#3B82F6]">월 {Number(report.monthlyManDays)}공수</span>
            )}
          </div>
        </div>

        {/* ── 공종 / 작업사항 선택 ───────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="text-[13px] font-semibold text-[#374151] mb-2">공종 / 작업사항</div>
          <div className="flex gap-2 mb-2">
            <Sel label="공종계열" value={familyCode}
              onChange={(v) => { setFamilyCode(v); setTradeCode(''); setTaskCode('') }}
              options={families.map((f) => ({ value: f.code, label: f.label }))}
            />
            <Sel label="세부공종" value={tradeCode}
              onChange={(v) => { setTradeCode(v); setTaskCode('') }}
              options={tradeOptions}
            />
          </div>
          <Sel label="작업사항" value={taskCode}
            onChange={setTaskCode}
            options={taskOptions}
            placeholder="작업사항 선택 (또는 직접입력)"
          />
          <textarea
            placeholder="세부 작업 내용 (선택사항)"
            value={workDetail}
            onChange={(e) => setWorkDetail(e.target.value)}
            rows={2}
            className="w-full mt-2 text-[13px] border border-[#E5E7EB] rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316] resize-none"
          />
        </div>

        {/* ── 작업 위치 ──────────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="text-[13px] font-semibold text-[#374151] mb-2">작업 위치</div>
          <div className="flex gap-2">
            <Sel label="동" value={building}
              onChange={(v) => { setBuilding(v); setFloor(''); setLocDetail('') }}
              options={buildings.map((b) => ({ value: b, label: b }))}
              placeholder="동 선택"
            />
            <Sel label="층" value={floor}
              onChange={(v) => { setFloor(v); setLocDetail('') }}
              options={floorOptions}
              placeholder="층 선택"
            />
            {detailOptions.length > 0 ? (
              <Sel label="상세위치" value={locDetail}
                onChange={setLocDetail}
                options={detailOptions}
                placeholder="상세위치"
              />
            ) : (
              <div className="flex-1">
                <div className="text-[11px] text-[#9CA3AF] mb-1">상세위치</div>
                <input type="text" placeholder="직접입력" value={locDetail}
                  onChange={(e) => setLocDetail(e.target.value)}
                  className="w-full text-[13px] border border-[#E5E7EB] rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316]"
                />
              </div>
            )}
          </div>
          {(building || floor || locDetail) && (
            <div className="text-[12px] text-[#F97316] mt-2">
              {[building, floor, locDetail].filter(Boolean).join(' ')}
            </div>
          )}
        </div>

        {/* ── 빠른 입력 버튼 ─────────────────────────────── */}
        <div className="flex gap-2 mt-3">
          {yesterdayReport && (
            <button onClick={loadYesterday}
              className="flex-1 text-[12px] py-2.5 rounded-lg bg-[#F0F9FF] text-[#3B82F6] font-medium border border-[#BFDBFE]">
              어제 작업 불러오기
            </button>
          )}
          <button onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex-1 text-[12px] py-2.5 rounded-lg bg-[#FFF7ED] text-[#F97316] font-medium border border-[#FDBA74]">
            최근 작업 선택
          </button>
          <button onClick={copyToTomorrow}
            className="flex-1 text-[12px] py-2.5 rounded-lg bg-[#F0FDF4] text-[#22C55E] font-medium border border-[#BBF7D0]">
            금일 내용 복사
          </button>
        </div>

        {/* ── 제안 목록 ──────────────────────────────────── */}
        {showSuggestions && (recentItems.length > 0 || frequentItems.length > 0) && (
          <div className="bg-white rounded-xl mt-2 border border-[#E5E7EB] overflow-hidden">
            {recentItems.length > 0 && (
              <>
                <div className="text-[11px] text-[#9CA3AF] px-3 py-1.5 bg-[#F9FAFB]">최근 작업</div>
                {recentItems.map((item, i) => (
                  <button key={`r-${i}`} onClick={() => selectSuggestion(item)}
                    className="w-full text-left text-[13px] px-3 py-2 text-[#374151] border-t border-[#F3F4F6] hover:bg-[#FFF7ED] transition-colors">
                    <span className="font-medium">{item.text}</span>
                    {item.tradeLabel && <span className="text-[11px] text-[#9CA3AF] ml-2">{item.tradeLabel}</span>}
                    {item.locationDisplayName && <span className="text-[11px] text-[#9CA3AF] ml-1">· {item.locationDisplayName}</span>}
                  </button>
                ))}
              </>
            )}
            {frequentItems.length > 0 && (
              <>
                <div className="text-[11px] text-[#9CA3AF] px-3 py-1.5 bg-[#F9FAFB]">자주 쓰는 작업</div>
                {frequentItems.map((item, i) => (
                  <button key={`f-${i}`} onClick={() => selectSuggestion(item)}
                    className="w-full text-left text-[13px] px-3 py-2 text-[#374151] border-t border-[#F3F4F6] hover:bg-[#FFF7ED] transition-colors">
                    <span className="font-medium">{item.text}</span>
                    <span className="text-[11px] text-[#9CA3AF] ml-2">({item.count}회)</span>
                  </button>
                ))}
              </>
            )}
            <button onClick={() => setShowSuggestions(false)}
              className="w-full text-[11px] text-[#9CA3AF] py-1.5 bg-[#F9FAFB] border-t border-[#E5E7EB]">
              닫기
            </button>
          </div>
        )}

        {/* ── 어제 작업 ──────────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="text-[13px] font-semibold text-[#374151] mb-2">어제 작업</div>
          <textarea placeholder="어제 수행한 작업 내용" value={yesterdayWork}
            onChange={(e) => setYesterdayWork(e.target.value)} rows={2}
            className="w-full text-[13px] border border-[#E5E7EB] rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316] resize-none"
          />
        </div>

        {/* ── 금일 작업 ──────────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold text-[#374151]">금일 작업</div>
            {report && report.consecutiveDays > 1 && (
              <span className="text-[11px] bg-[#FFF7ED] text-[#F97316] px-2 py-0.5 rounded-full font-medium">
                {report.consecutiveDays}일째 진행중
              </span>
            )}
          </div>
          <textarea placeholder="오늘 수행한 작업 내용" value={todayWork}
            onChange={(e) => setTodayWork(e.target.value)} rows={3}
            className="w-full text-[13px] border border-[#E5E7EB] rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316] resize-none"
          />
        </div>

        {/* ── 명일 작업 ──────────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3">
          <div className="text-[13px] font-semibold text-[#374151] mb-2">명일 작업</div>
          <textarea placeholder="내일 예정된 작업 내용" value={tomorrowWork}
            onChange={(e) => setTomorrowWork(e.target.value)} rows={2}
            className="w-full text-[13px] border border-[#E5E7EB] rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316] resize-none"
          />
        </div>

        {/* ── 작업시간 + 특이사항 + 자재 ─────────────────── */}
        <div className="bg-white rounded-xl p-4 mt-3 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="text-[11px] text-[#9CA3AF] mb-1">작업시간</div>
              <div className="flex gap-2 items-center">
                <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)}
                  className="flex-1 text-[13px] border border-[#E5E7EB] rounded-lg px-2 py-2 bg-white focus:outline-none focus:border-[#F97316]" />
                <span className="text-[#9CA3AF]">~</span>
                <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)}
                  className="flex-1 text-[13px] border border-[#E5E7EB] rounded-lg px-2 py-2 bg-white focus:outline-none focus:border-[#F97316]" />
              </div>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#9CA3AF] mb-1">특이사항</div>
            <textarea placeholder="특이사항이 있으면 입력" value={notes}
              onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full text-[13px] border border-[#E5E7EB] rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:border-[#F97316] resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-[#9CA3AF]">자재사용</div>
            <button onClick={() => setMaterialUsed(!materialUsed)}
              className="text-[12px] px-3 py-1 rounded-lg border transition-colors"
              style={{
                background: materialUsed ? '#FFF7ED' : '#fff',
                borderColor: materialUsed ? '#F97316' : '#E5E7EB',
                color: materialUsed ? '#F97316' : '#6B7280',
              }}>
              {materialUsed ? '있음' : '없음'}
            </button>
            {materialUsed && (
              <input type="text" placeholder="자재 메모" value={materialNote}
                onChange={(e) => setMaterialNote(e.target.value)}
                className="flex-1 text-[13px] border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#F97316]" />
            )}
          </div>
        </div>

        {/* ── 자동 표시 영역 ─────────────────────────────── */}
        {report && (
          <div className="flex gap-3 mt-3">
            {report.consecutiveDays > 1 && (
              <div className="bg-[#FFF7ED] px-3 py-2 rounded-lg text-[12px]">
                <span className="text-[#F97316] font-semibold">반복 {report.consecutiveDays}일째</span>
              </div>
            )}
            <div className="bg-[#FFF7ED] px-3 py-2 rounded-lg text-[12px]">
              <span className="text-[#9CA3AF]">일 </span>
              <span className="font-semibold text-[#F97316]">{Number(report.todayManDays)}공수</span>
            </div>
            <div className="bg-[#F0F9FF] px-3 py-2 rounded-lg text-[12px]">
              <span className="text-[#9CA3AF]">월 </span>
              <span className="font-semibold text-[#3B82F6]">{Number(report.monthlyManDays)}공수</span>
            </div>
          </div>
        )}

        {/* ── 메시지 ─────────────────────────────────────── */}
        {msg && <div className="mt-3 text-center text-[13px] text-[#F97316] font-medium">{msg}</div>}

        {/* ── 저장 버튼 ──────────────────────────────────── */}
        <button onClick={handleSave} disabled={saving}
          className="w-full mt-4 py-4 rounded-xl text-white text-[15px] font-bold transition-colors"
          style={{ background: saving ? '#FDBA74' : '#F97316' }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
      <WorkerBottomNav />
    </div>
  )
}
