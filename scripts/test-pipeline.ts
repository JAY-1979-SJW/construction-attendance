/**
 * 전체 파이프라인 점검 v1.0
 * 승인 → 출근 → 이동 → 퇴근/자동퇴근 → 관리자 반영 → 수동 보정 → 집계 → 엑셀 출력
 *
 * 실행: npx tsx scripts/test-pipeline.ts
 */

import { haversineDistance, isWithinRadius } from '../lib/gps/distance'

// ── 색상/결과 헬퍼 ─────────────────────────────────────────────────
let passed = 0, failed = 0, scenarioPassed = 0, scenarioFailed = 0
const c = {
  ok:     (s: string) => `\x1b[32m✓ ${s}\x1b[0m`,
  fail:   (s: string) => `\x1b[31m✗ ${s}\x1b[0m`,
  info:   (s: string) => `\x1b[36m  ${s}\x1b[0m`,
  head:   (s: string) => `\x1b[1m\x1b[33m${s}\x1b[0m`,
  scene:  (s: string) => `\x1b[1m\x1b[35m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[90m  ${s}\x1b[0m`,
}
function assert(cond: boolean, label: string, detail?: string) {
  if (cond) { console.log(c.ok(label)); passed++ }
  else       { console.log(c.fail(label)); if (detail) console.log(c.info('원인: ' + detail)); failed++ }
}
function scenario(name: string, fn: () => void) {
  const before = failed
  console.log(c.scene(`\n┌─ ${name} ─`))
  fn()
  const thisFailed = failed - before
  if (thisFailed === 0) { scenarioPassed++; console.log(c.scene(`└─ PASS\n`)) }
  else { scenarioFailed++; console.log(c.scene(`└─ FAIL (${thisFailed}건)\n`)) }
}

// ── 인메모리 DB ──────────────────────────────────────────────────────
type LogStatus = 'WORKING' | 'COMPLETED' | 'MISSING_CHECKOUT' | 'ADJUSTED' | 'EXCEPTION'
type Site           = { id: string; name: string; latitude: number; longitude: number; allowedRadius: number; qrToken: string }
type Worker         = { id: string; name: string; phone: string; company: string; jobTitle: string; isActive: boolean }
type WorkerDevice   = { id: string; workerId: string; deviceToken: string; isActive: boolean }
type AttendanceLog  = {
  id: string; workerId: string; siteId: string; checkOutSiteId: string | null
  workDate: string; checkInAt: Date; checkOutAt: Date | null
  checkInDistance: number | null; checkOutDistance: number | null
  status: LogStatus; adminNote: string | null; qrToken: string
}
type AttendanceEvent = {
  id: string; attendanceLogId: string; workerId: string
  eventType: 'CHECKIN' | 'MOVE' | 'CHECKOUT'; siteId: string
  latitude: number; longitude: number; distanceFromSite: number; occurredAt: Date
}
type AuditLog = {
  id: string; adminId: string; actionType: string
  targetType: string; targetId: string; description: string; createdAt: Date
}

const DB = {
  sites:   [] as Site[],
  workers: [] as Worker[],
  devices: [] as WorkerDevice[],
  logs:    [] as AttendanceLog[],
  events:  [] as AttendanceEvent[],
  audits:  [] as AuditLog[],
  nextId: 1,
  id:  () => `id_${DB.nextId++}`,
  reset() { this.sites=[]; this.workers=[]; this.devices=[]; this.logs=[]; this.events=[]; this.audits=[]; this.nextId=1 },
}

// ── 날짜 유틸 ─────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10)
function yesterday(): string {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
function dateOf(s: string): Date { return new Date(s + 'T00:00:00+09:00') }

// ── GPS 좌표 정의 ──────────────────────────────────────────────────────
// A현장: 서울 강남구 테헤란로 (반경 100m)
const SITE_A_LAT = 37.5012743, SITE_A_LNG = 127.0396597
// B현장: 역삼역 (반경 100m)
const SITE_B_LAT = 37.4981,    SITE_B_LNG = 127.0276
// 반경 내 좌표
const INSIDE_A  = { lat: 37.5012743, lng: 127.0400 }   // ~30m from A
const INSIDE_B  = { lat: 37.4985,    lng: 127.0276 }   // ~44m from B
const OUTSIDE   = { lat: 37.508,     lng: 127.040  }   // ~800m 외부

// ── 비즈니스 로직 (각 lib 파일과 1:1 대응) ──────────────────────────

function getSite(qrToken: string) { return DB.sites.find(s => s.qrToken === qrToken) }
function validateDevice(workerId: string, deviceToken: string) {
  return DB.devices.some(d => d.workerId === workerId && d.deviceToken === deviceToken && d.isActive)
}
function getTodayLog(workerId: string) {
  return DB.logs.find(l => l.workerId === workerId && l.workDate === TODAY && l.status === 'WORKING' && !l.checkOutAt)
}
function getLastMove(logId: string) {
  return DB.events
    .filter(e => e.attendanceLogId === logId && e.eventType === 'MOVE')
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0]
}

// check-in.ts 1:1
function checkIn(workerId: string, deviceToken: string, qrToken: string, lat: number, lng: number) {
  if (!validateDevice(workerId, deviceToken)) return { success: false, message: '미승인 기기' }
  const site = getSite(qrToken)
  if (!site) return { success: false, message: '유효하지 않은 QR' }
  const { within, distance } = isWithinRadius(lat, lng, site.latitude, site.longitude, site.allowedRadius)
  if (!within) return { success: false, message: `반경 밖 ${Math.round(distance)}m` }
  const exists = DB.logs.find(l => l.workerId === workerId && l.siteId === site.id && l.workDate === TODAY)
  if (exists) return { success: false, message: '이미 출근 처리됨' }
  const log: AttendanceLog = {
    id: DB.id(), workerId, siteId: site.id, checkOutSiteId: null,
    workDate: TODAY, checkInAt: new Date(), checkOutAt: null,
    checkInDistance: distance, checkOutDistance: null,
    status: 'WORKING', adminNote: null, qrToken,
  }
  DB.logs.push(log)
  return { success: true, attendanceId: log.id, distance }
}

// move.ts 1:1
function move(workerId: string, deviceToken: string, qrToken: string, lat: number, lng: number) {
  if (!validateDevice(workerId, deviceToken)) return { success: false, message: '미승인 기기' }
  const openLog = DB.logs.find(l => l.workerId === workerId && l.status === 'WORKING' && !l.checkOutAt)
  if (!openLog) return { success: false, message: '출근 기록 없음' }
  const newSite = getSite(qrToken)
  if (!newSite) return { success: false, message: '유효하지 않은 QR' }
  const lastMove = getLastMove(openLog.id)
  const currentSiteId = lastMove?.siteId ?? openLog.siteId
  if (currentSiteId === newSite.id) return { success: false, message: '동일 현장 이동' }
  const { within, distance } = isWithinRadius(lat, lng, newSite.latitude, newSite.longitude, newSite.allowedRadius)
  if (!within) return { success: false, message: `새 현장 반경 밖 ${Math.round(distance)}m` }
  const ev: AttendanceEvent = {
    id: DB.id(), attendanceLogId: openLog.id, workerId,
    eventType: 'MOVE', siteId: newSite.id,
    latitude: lat, longitude: lng, distanceFromSite: distance, occurredAt: new Date(),
  }
  DB.events.push(ev)
  return { success: true, eventId: ev.id, newSiteId: newSite.id, newSiteName: newSite.name, distance }
}

// check-out.ts 1:1
function checkOut(workerId: string, deviceToken: string, qrToken: string, lat: number, lng: number) {
  if (!validateDevice(workerId, deviceToken)) return { success: false, message: '미승인 기기' }
  const site = getSite(qrToken)
  if (!site) return { success: false, message: '유효하지 않은 QR' }
  const { within, distance } = isWithinRadius(lat, lng, site.latitude, site.longitude, site.allowedRadius)
  if (!within) return { success: false, message: `반경 밖 ${Math.round(distance)}m` }
  const log = DB.logs.find(l => l.workerId === workerId && l.status === 'WORKING' && !l.checkOutAt && l.workDate === TODAY)
  if (!log) return { success: false, message: '출근 기록 없음' }
  const lastMove = getLastMove(log.id)
  const currentSiteId = lastMove?.siteId ?? log.siteId
  if (currentSiteId !== site.id) return { success: false, message: '현재 현장 QR 사용' }
  const checkOutSiteId = site.id !== log.siteId ? site.id : null
  log.checkOutAt = new Date()
  log.checkOutDistance = distance
  log.checkOutSiteId = checkOutSiteId
  log.status = 'COMPLETED'
  return { success: true, distance }
}

// autoCheckout.ts 1:1 (workDate < today 기준)
function runAutoCheckout(overrideToday = TODAY) {
  const todayDate = dateOf(overrideToday)
  const targets = DB.logs.filter(l => l.status === 'WORKING' && !l.checkOutAt && dateOf(l.workDate) < todayDate)
  let processed = 0, skipped = 0
  for (const log of targets) {
    const current = DB.logs.find(l => l.id === log.id)
    if (!current || current.status !== 'WORKING' || current.checkOutAt !== null) { skipped++; continue }
    const lastMove = getLastMove(log.id)
    const checkOutSiteId = lastMove?.siteId && lastMove.siteId !== log.siteId ? lastMove.siteId : null
    current.status = 'MISSING_CHECKOUT'
    current.checkOutSiteId = checkOutSiteId
    current.adminNote = `[AUTO] 04:00 자동 퇴근 미기록 처리. 실행시각: ${new Date().toISOString()}`
    processed++
  }
  return { totalFound: targets.length, processed, skipped }
}

// PATCH /api/admin/attendance/[id] 1:1
function adminPatchAttendance(
  logId: string, adminId: string,
  patch: { checkOutAt?: string; status?: LogStatus; adminNote?: string }
) {
  const log = DB.logs.find(l => l.id === logId)
  if (!log) return { success: false, message: '기록 없음' }
  if (patch.checkOutAt) log.checkOutAt = new Date(patch.checkOutAt)
  if (patch.status)    log.status     = patch.status
  if (patch.adminNote) log.adminNote  = patch.adminNote
  // audit log
  DB.audits.push({
    id: DB.id(), adminId, actionType: 'ADJUST_ATTENDANCE',
    targetType: 'AttendanceLog', targetId: logId,
    description: `출퇴근 수정: ${logId} | 변경항목: ${Object.keys(patch).join(', ')}`,
    createdAt: new Date(),
  })
  return { success: true, data: { id: log.id, status: log.status, checkOutAt: log.checkOutAt?.toISOString() } }
}

// 관리자 목록 조회 (attendance/route.ts 1:1)
function adminListAttendance(filter: { siteId?: string; status?: LogStatus; workDate?: string }) {
  return DB.logs.filter(l => {
    if (filter.status && l.status !== filter.status) return false
    if (filter.workDate && l.workDate !== filter.workDate) return false
    if (filter.siteId) {
      // 인정 현장 기준 필터 (allocatedSiteId)
      const lastMove = getLastMove(l.id)
      const allocatedSiteId = lastMove?.siteId ?? l.siteId
      if (allocatedSiteId !== filter.siteId) return false
    }
    return true
  })
}

// ── 노임 집계 엔진 (lib/labor/aggregate.ts 1:1) ──────────────────────
interface LaborRow {
  attendanceLogId: string; workDate: string
  workerName: string; company: string; jobTitle: string
  checkInSiteId: string; checkInSiteName: string
  lastSiteId: string; lastSiteName: string
  allocatedSiteId: string; allocatedSiteName: string
  hasMove: boolean
  checkInAt: string | null; checkOutAt: string | null
  totalWorkedMinutes: number | null
  status: string; isAutoCheckout: boolean; isAdjusted: boolean
  includeInLabor: boolean; needsReview: boolean
  adminNote: string | null
}
interface SummaryRow {
  workerName: string; company: string; jobTitle: string
  allocatedSiteId: string; allocatedSiteName: string
  totalDays: number; totalMinutes: number
  adjustedDays: number; autoCheckoutDays: number; needsReviewDays: number
}

function aggregateLabor(dateFrom: string, dateTo: string, siteId?: string): LaborRow[] {
  const from = dateOf(dateFrom), to = dateOf(dateTo)
  const logs = DB.logs.filter(l => {
    const d = dateOf(l.workDate)
    return d >= from && d <= to && l.status !== 'WORKING'
  })
  return logs.map(log => {
    const worker   = DB.workers.find(w => w.id === log.workerId)!
    const site     = DB.sites.find(s => s.id === log.siteId)!
    const lastMove = getLastMove(log.id)
    const lastSite = lastMove ? DB.sites.find(s => s.id === lastMove.siteId) : null
    const hasMove  = !!lastMove
    const lastSiteId   = lastSite?.id   ?? site.id
    const lastSiteName = lastSite?.name ?? site.name
    const totalWorkedMinutes = log.checkInAt && log.checkOutAt
      ? Math.max(0, Math.round((log.checkOutAt.getTime() - log.checkInAt.getTime()) / 60000)) : null
    const isAutoCheckout = log.adminNote?.includes('[AUTO]') ?? false
    const isAdjusted     = log.status === 'ADJUSTED'
    const includeInLabor = log.status === 'COMPLETED' || log.status === 'ADJUSTED'
    const needsReview    = log.status === 'MISSING_CHECKOUT'
    return {
      attendanceLogId: log.id, workDate: log.workDate,
      workerName: worker.name, company: worker.company, jobTitle: worker.jobTitle,
      checkInSiteId: site.id, checkInSiteName: site.name,
      lastSiteId, lastSiteName,
      allocatedSiteId: lastSiteId, allocatedSiteName: lastSiteName,
      hasMove,
      checkInAt: log.checkInAt ? log.checkInAt.toISOString() : null,
      checkOutAt: log.checkOutAt ? log.checkOutAt.toISOString() : null,
      totalWorkedMinutes,
      status: log.status, isAutoCheckout, isAdjusted, includeInLabor, needsReview,
      adminNote: log.adminNote,
    }
  }).filter(r => !siteId || r.allocatedSiteId === siteId)
}

function summarizeLabor(rows: LaborRow[]): SummaryRow[] {
  const map = new Map<string, SummaryRow>()
  for (const r of rows) {
    if (!r.includeInLabor) continue
    const key = `${r.workerName}::${r.allocatedSiteId}`
    const ex = map.get(key)
    if (ex) {
      ex.totalDays++; ex.totalMinutes += r.totalWorkedMinutes ?? 0
      if (r.isAdjusted) ex.adjustedDays++
      if (r.isAutoCheckout) ex.autoCheckoutDays++
    } else {
      map.set(key, {
        workerName: r.workerName, company: r.company, jobTitle: r.jobTitle,
        allocatedSiteId: r.allocatedSiteId, allocatedSiteName: r.allocatedSiteName,
        totalDays: 1, totalMinutes: r.totalWorkedMinutes ?? 0,
        adjustedDays: r.isAdjusted ? 1 : 0, autoCheckoutDays: r.isAutoCheckout ? 1 : 0, needsReviewDays: 0,
      })
    }
  }
  for (const r of rows) {
    if (!r.needsReview) continue
    const key = `${r.workerName}::${r.allocatedSiteId}`
    const ex = map.get(key)
    if (ex) ex.needsReviewDays++
    else map.set(key, {
      workerName: r.workerName, company: r.company, jobTitle: r.jobTitle,
      allocatedSiteId: r.allocatedSiteId, allocatedSiteName: r.allocatedSiteName,
      totalDays: 0, totalMinutes: 0, adjustedDays: 0, autoCheckoutDays: 0, needsReviewDays: 1,
    })
  }
  return Array.from(map.values())
}

function fmtMin(m: number | null): string {
  if (!m || m <= 0) return '-'
  const h = Math.floor(m / 60), min = m % 60
  return h > 0 ? (min > 0 ? `${h}h ${min}m` : `${h}h`) : `${min}m`
}

// ── 테스트 픽스처 셋업 ────────────────────────────────────────────────
function setupFixtures() {
  DB.reset()

  const SITE_A: Site = {
    id: DB.id(), name: 'A현장 (테헤란로)', latitude: SITE_A_LAT, longitude: SITE_A_LNG, allowedRadius: 100,
    qrToken: 'qr_site_a_001',
  }
  const SITE_B: Site = {
    id: DB.id(), name: 'B현장 (역삼역)', latitude: SITE_B_LAT, longitude: SITE_B_LNG, allowedRadius: 100,
    qrToken: 'qr_site_b_002',
  }
  DB.sites.push(SITE_A, SITE_B)

  const W1: Worker = { id: DB.id(), name: '김철수', phone: '01011110001', company: '해한건설', jobTitle: '목공', isActive: true }
  const W2: Worker = { id: DB.id(), name: '이영희', phone: '01011110002', company: '협력A', jobTitle: '철근', isActive: true }
  DB.workers.push(W1, W2)

  const D1: WorkerDevice = { id: DB.id(), workerId: W1.id, deviceToken: 'dt_w1_approved', isActive: true }
  const D2: WorkerDevice = { id: DB.id(), workerId: W2.id, deviceToken: 'dt_w2_approved', isActive: true }
  DB.devices.push(D1, D2)

  const UNAPPROVED_TOKEN = 'dt_unapproved_device'

  const ADMIN_ID = 'admin_001'

  return { SITE_A, SITE_B, W1, W2, D1, D2, UNAPPROVED_TOKEN, ADMIN_ID }
}

// ════════════════════════════════════════════════════════════════════
// 메인 테스트
// ════════════════════════════════════════════════════════════════════
function run() {
  console.log(c.head('\n╔═══════════════════════════════════════════════════════╗'))
  console.log(c.head('║   전체 파이프라인 점검 v1.0                               ║'))
  console.log(c.head('║   승인→출근→이동→퇴근→집계→엑셀 end-to-end 검증         ║'))
  console.log(c.head('╚═══════════════════════════════════════════════════════╝\n'))

  // ─────────────────────────────────────────────────────────────────
  scenario('시나리오 1 — 동일 현장 정상 출근/퇴근 → COMPLETED → 집계 포함', () => {
    const { SITE_A, W1, D1 } = setupFixtures()

    // 1. 출근
    const ci = checkIn(W1.id, D1.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    console.log(c.dim(`출근: success=${ci.success} dist=${ci.distance}m`))
    assert(ci.success === true, '출근 성공')
    assert(ci.distance !== undefined && ci.distance <= 100, `출근 거리 반경 내 (${ci.distance}m)`)

    // 2. 상태 = WORKING
    const logAfterIn = DB.logs[0]
    assert(logAfterIn.status === 'WORKING', '출근 후 status=WORKING')
    assert(logAfterIn.checkOutAt === null, '출근 후 checkOutAt=null')

    // 2-b. 출근 시각을 8시간 전으로 백데이트 (동기 테스트에서 인정시간 > 0 보장)
    DB.logs[0].checkInAt = new Date(Date.now() - 8 * 60 * 60 * 1000)

    // 3. 퇴근 (같은 A현장)
    const co = checkOut(W1.id, D1.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    console.log(c.dim(`퇴근: success=${co.success} dist=${co.distance}m`))
    assert(co.success === true, '퇴근 성공')

    // 4. 상태 = COMPLETED, checkOutAt 기록
    const logAfterOut = DB.logs[0]
    assert(logAfterOut.status === 'COMPLETED',    '퇴근 후 status=COMPLETED')
    assert(logAfterOut.checkOutAt !== null,        'checkOutAt 기록됨')
    assert(logAfterOut.checkOutSiteId === null,    '동일 현장 퇴근 → checkOutSiteId=null (정책)')

    // 5. 집계 엔진
    const rows    = aggregateLabor(TODAY, TODAY)
    const summary = summarizeLabor(rows)
    console.log(c.dim(`집계: rows=${rows.length} summary=${summary.length}`))
    assert(rows.length === 1,                              '집계 행 1건')
    assert(rows[0].allocatedSiteId === SITE_A.id,          '인정 현장 = A현장')
    assert(rows[0].hasMove === false,                      '이동 없음')
    assert(rows[0].includeInLabor === true,                '집계 포함 = 포함')
    assert(rows[0].totalWorkedMinutes !== null && rows[0].totalWorkedMinutes > 0, '인정 시간 > 0')

    // 6. 합계
    assert(summary.length === 1,           '노임 합계 1건')
    assert(summary[0].totalDays === 1,     '투입일수 1일')
    assert(summary[0].adjustedDays === 0,  '보정 건수 0')
    assert(summary[0].needsReviewDays === 0, '검토 필요 0건')

    // 7. 관리자 화면 반영
    const adminList = adminListAttendance({ status: 'COMPLETED' })
    assert(adminList.length === 1, '관리자 목록에 COMPLETED 1건')

    // 8. 엑셀 출력 시뮬레이션 (집계포함 컬럼)
    const excelRow = {
      날짜: rows[0].workDate, 인정현장: rows[0].allocatedSiteName,
      인정시간: fmtMin(rows[0].totalWorkedMinutes), 상태: rows[0].status,
      집계포함: rows[0].includeInLabor ? '포함' : '제외',
    }
    console.log(c.dim(`엑셀시트1: 날짜=${excelRow.날짜} 인정현장=${excelRow.인정현장} 인정시간=${excelRow.인정시간} 상태=${excelRow.상태} 집계=${excelRow.집계포함}`))
    assert(excelRow.집계포함 === '포함', '엑셀 시트1 집계포함 = 포함')
    assert(excelRow.상태 === 'COMPLETED', '엑셀 시트1 상태 = COMPLETED')
    assert(excelRow.인정현장 === SITE_A.name, '엑셀 시트1 인정현장 = A현장')
  })

  // ─────────────────────────────────────────────────────────────────
  scenario('시나리오 2 — A출근 → B이동 → B퇴근 → 인정현장 = B', () => {
    const { SITE_A, SITE_B, W1, D1 } = setupFixtures()

    // 출근 A
    const ci = checkIn(W1.id, D1.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    assert(ci.success === true, '출근(A) 성공')

    // 이동 A→B
    const mv = move(W1.id, D1.deviceToken, SITE_B.qrToken, INSIDE_B.lat, INSIDE_B.lng)
    console.log(c.dim(`이동: success=${mv.success} → ${mv.newSiteName}`))
    assert(mv.success === true,              '이동(A→B) 성공')
    assert(mv.newSiteId === SITE_B.id,       '이동 대상 = B현장')

    // WORKING 유지 확인
    assert(DB.logs[0].status === 'WORKING', '이동 후 status=WORKING 유지')

    // 퇴근 B
    const co = checkOut(W1.id, D1.deviceToken, SITE_B.qrToken, INSIDE_B.lat, INSIDE_B.lng)
    assert(co.success === true, '퇴근(B) 성공')

    // 원천 기록: MOVE 1건, checkOutSiteId=B
    const moveEvents = DB.events.filter(e => e.eventType === 'MOVE')
    assert(moveEvents.length === 1,                     'MOVE 이벤트 1건 기록')
    assert(DB.logs[0].checkOutSiteId === SITE_B.id,     'checkOutSiteId = B현장')

    // 집계: 인정현장 = B
    const rows = aggregateLabor(TODAY, TODAY)
    console.log(c.dim(`집계: allocatedSite=${rows[0]?.allocatedSiteName} hasMove=${rows[0]?.hasMove}`))
    assert(rows[0].allocatedSiteId === SITE_B.id,       '인정 현장 = B현장 (이동 후 마지막 현장 기준)')
    assert(rows[0].checkInSiteId   === SITE_A.id,       '출근 현장 = A현장 (원천 유지)')
    assert(rows[0].hasMove === true,                    '이동 여부 = true')
    assert(rows[0].includeInLabor === true,             '집계 포함')

    // 합계: B현장 기준
    const summary = summarizeLabor(rows)
    assert(summary[0].allocatedSiteId === SITE_B.id,    '노임집계 인정현장 = B현장')
    assert(summary[0].totalDays === 1,                  '투입일수 1일')

    // 엑셀 시트1 이동 표시
    const excelRow = { 이동: rows[0].hasMove ? '이동있음' : '-', 출근현장: rows[0].checkInSiteName, 인정현장: rows[0].allocatedSiteName }
    console.log(c.dim(`엑셀시트1: 출근현장=${excelRow.출근현장} 이동=${excelRow.이동} 인정현장=${excelRow.인정현장}`))
    assert(excelRow.이동 === '이동있음',                '엑셀 시트1 이동 표시')
    assert(excelRow.출근현장 === SITE_A.name,           '엑셀 시트1 출근현장 = A')
    assert(excelRow.인정현장 === SITE_B.name,           '엑셀 시트1 인정현장 = B')
  })

  // ─────────────────────────────────────────────────────────────────
  scenario('시나리오 3 — 퇴근 누락 → 자동퇴근 → MISSING_CHECKOUT → 집계 제외', () => {
    const { SITE_A, W1, D1 } = setupFixtures()

    // 전일 출근 기록 직접 생성 (자동퇴근 대상)
    const yest = yesterday()
    const autoLog = {
      id: DB.id(), workerId: W1.id, siteId: SITE_A.id, checkOutSiteId: null,
      workDate: yest, checkInAt: new Date(`${yest}T08:00:00+09:00`), checkOutAt: null,
      checkInDistance: 30, checkOutDistance: null, status: 'WORKING' as LogStatus,
      adminNote: null, qrToken: SITE_A.qrToken,
    }
    DB.logs.push(autoLog)
    assert(DB.logs[0].status === 'WORKING', '자동퇴근 전 status=WORKING')

    // 자동퇴근 실행
    const result = runAutoCheckout(TODAY)
    console.log(c.dim(`자동퇴근: totalFound=${result.totalFound} processed=${result.processed}`))
    assert(result.totalFound === 1,   '대상 1건 선정')
    assert(result.processed  === 1,   '1건 처리됨')

    // 상태 확인
    const log = DB.logs[0]
    console.log(c.dim(`처리 후: status=${log.status} checkOutAt=${log.checkOutAt} AUTO=${log.adminNote?.includes('[AUTO]')}`))
    assert(log.status === 'MISSING_CHECKOUT',         '자동퇴근 후 status=MISSING_CHECKOUT')
    assert(log.checkOutAt === null,                   'checkOutAt 미기록 (의도적 설계)')
    assert(log.adminNote?.includes('[AUTO]') === true,'adminNote에 [AUTO] 태그')

    // 관리자 화면: MISSING_CHECKOUT 필터
    const missing = adminListAttendance({ status: 'MISSING_CHECKOUT' })
    assert(missing.length === 1, '관리자 화면 MISSING_CHECKOUT 1건')

    // 집계: 포함 안 됨, 검토 필요 건수 1
    const rows    = aggregateLabor(yest, yest)
    const summary = summarizeLabor(rows)
    console.log(c.dim(`집계: includeInLabor=${rows[0]?.includeInLabor} needsReview=${rows[0]?.needsReview}`))
    assert(rows[0].includeInLabor === false,         '집계 포함 = 제외')
    assert(rows[0].needsReview    === true,          '검토 필요 = true')
    assert(rows[0].isAutoCheckout === true,          'isAutoCheckout = true')
    assert(rows[0].totalWorkedMinutes === null,       '인정 시간 = null (checkOutAt 없음)')

    // 노임 합계: 검토 필요 건수만 표시
    const s = summary.find(s => s.workerName === W1.name)
    assert(s !== undefined,               '노임 합계에 근로자 존재 (검토건 참고)')
    assert(s?.totalDays       === 0,      '노임 합계 투입일수 = 0 (미포함)')
    assert(s?.needsReviewDays === 1,      '검토 필요 건수 = 1')

    // 엑셀 시트1: 상태 표시, 집계포함=제외
    const excelRow = { 상태: rows[0].status, 집계포함: rows[0].includeInLabor ? '포함' : '제외', AUTO: rows[0].isAutoCheckout ? 'AUTO' : '' }
    assert(excelRow.집계포함 === '제외',  '엑셀 시트1 집계포함 = 제외')
    assert(excelRow.AUTO     === 'AUTO',  '엑셀 시트1 AUTO 표시')
    // 시트2 합계: 포함 안 됨
    const s2 = summary[0]
    assert(s2?.totalDays === 0,           '엑셀 시트2 노임합계 투입일수 = 0 (미포함)')
  })

  // ─────────────────────────────────────────────────────────────────
  scenario('시나리오 4 — 자동퇴근 건 수동 보정 → ADJUSTED → 집계 포함 전환', () => {
    const { SITE_A, W1, D1, ADMIN_ID } = setupFixtures()

    // 전일 자동퇴근 건 준비
    const yest = yesterday()
    const autoLog: AttendanceLog = {
      id: DB.id(), workerId: W1.id, siteId: SITE_A.id, checkOutSiteId: null,
      workDate: yest, checkInAt: new Date(`${yest}T08:00:00+09:00`), checkOutAt: null,
      checkInDistance: 30, checkOutDistance: null, status: 'MISSING_CHECKOUT',
      adminNote: `[AUTO] 04:00 자동 퇴근 미기록 처리. 실행시각: ${new Date().toISOString()}`,
      qrToken: SITE_A.qrToken,
    }
    DB.logs.push(autoLog)

    // 보정 전 집계
    const rowsBefore = aggregateLabor(yest, yest)
    assert(rowsBefore[0].includeInLabor === false, '보정 전 집계 포함 = 제외')

    // 수동 보정 실행
    const patchResult = adminPatchAttendance(autoLog.id, ADMIN_ID, {
      checkOutAt: `${yest}T18:00:00+09:00`,
      status: 'ADJUSTED',
      adminNote: '관리자 보정: 18:00 퇴근 확인됨',
    })
    console.log(c.dim(`보정 결과: success=${patchResult.success} status=${patchResult.data?.status}`))
    assert(patchResult.success === true,               '보정 저장 성공')
    assert(patchResult.data?.status === 'ADJUSTED',    '보정 후 status=ADJUSTED')
    assert(autoLog.checkOutAt !== null,                'checkOutAt 기록됨')

    // 감사 로그
    const audits = DB.audits.filter(a => a.targetId === autoLog.id)
    assert(audits.length === 1,                        '감사 로그 1건 생성')
    assert(audits[0].adminId === ADMIN_ID,             '감사 로그 관리자ID 기록')
    assert(audits[0].actionType === 'ADJUST_ATTENDANCE','감사 로그 액션타입 기록')

    // 보정 후 집계
    const rowsAfter   = aggregateLabor(yest, yest)
    const summaryAfter = summarizeLabor(rowsAfter)
    console.log(c.dim(`보정 후 집계: includeInLabor=${rowsAfter[0].includeInLabor} isAdjusted=${rowsAfter[0].isAdjusted}`))
    assert(rowsAfter[0].includeInLabor === true,       '보정 후 집계 포함 = 포함')
    assert(rowsAfter[0].isAdjusted     === true,       'isAdjusted = true')
    assert(rowsAfter[0].totalWorkedMinutes !== null,   '인정 시간 계산됨 (보정 퇴근 시각 기준)')
    assert(rowsAfter[0].totalWorkedMinutes === 600,    `인정 시간 = 600분 (08:00~18:00) → ${fmtMin(rowsAfter[0].totalWorkedMinutes)}`)

    // 노임 합계: 보정건 반영
    const s = summaryAfter.find(s => s.workerName === W1.name)
    assert(s?.totalDays    === 1, '노임 합계 투입일수 = 1')
    assert(s?.adjustedDays === 1, '보정 건수 = 1')

    // 엑셀 시트1 보정 표시
    assert(rowsAfter[0].status === 'ADJUSTED',         '엑셀 시트1 상태 = ADJUSTED')
    assert(rowsAfter[0].isAdjusted,                    '엑셀 시트1 보정 표시')
  })

  // ─────────────────────────────────────────────────────────────────
  scenario('시나리오 5 — 현장 필터 일관성 검증', () => {
    const { SITE_A, SITE_B, W1, W2, D1, D2 } = setupFixtures()

    // A현장 완료 건 (W1)
    checkIn(W1.id, D1.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    checkOut(W1.id, D1.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)

    // B현장 이동 건 (W2: A출근→B이동→B퇴근)
    checkIn(W2.id, D2.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    move(W2.id, D2.deviceToken, SITE_B.qrToken, INSIDE_B.lat, INSIDE_B.lng)
    checkOut(W2.id, D2.deviceToken, SITE_B.qrToken, INSIDE_B.lat, INSIDE_B.lng)

    // 전일 MISSING_CHECKOUT 건 (W1, A현장)
    const yest = yesterday()
    DB.logs.push({
      id: DB.id(), workerId: W1.id, siteId: SITE_A.id, checkOutSiteId: null,
      workDate: yest, checkInAt: new Date(`${yest}T09:00:00+09:00`), checkOutAt: null,
      checkInDistance: 25, checkOutDistance: null, status: 'MISSING_CHECKOUT',
      adminNote: '[AUTO] ...', qrToken: SITE_A.qrToken,
    })

    const allRows = aggregateLabor(yest, TODAY)
    console.log(c.dim(`전체: ${allRows.length}건 (A포함:${allRows.filter(r=>r.includeInLabor).length}, 검토:${allRows.filter(r=>r.needsReview).length})`))

    // A현장 필터 (인정 현장 기준)
    const rowsA = aggregateLabor(yest, TODAY, SITE_A.id)
    console.log(c.dim(`A현장 필터: ${rowsA.length}건 (W1 COMPLETED + W1 MISSING_CHECKOUT)`))
    assert(rowsA.length === 2,                              'A현장 필터: 2건 (W1 COMPLETED + MISSING_CHECKOUT)')
    assert(rowsA.every(r => r.allocatedSiteId === SITE_A.id), '모두 A현장 인정')

    // B현장 필터 (인정 현장 기준)
    const rowsB = aggregateLabor(yest, TODAY, SITE_B.id)
    console.log(c.dim(`B현장 필터: ${rowsB.length}건 (W2 이동→B인정)`))
    assert(rowsB.length === 1,                              'B현장 필터: 1건 (W2 이동건만)')
    assert(rowsB[0].allocatedSiteId === SITE_B.id,          'B현장 인정 확인')

    // 관리자 화면 A현장 필터 (인정현장 기준)
    const adminA = adminListAttendance({ siteId: SITE_A.id })
    assert(adminA.length === 2, '관리자 화면 A현장 필터: 2건')

    // 합계 건수 일치 (화면 ↔ 집계 API)
    const sumA = summarizeLabor(rowsA)
    const includedA = rowsA.filter(r => r.includeInLabor).length
    assert(includedA === 1,              'A현장 포함 건수 = 1 (MISSING_CHECKOUT 제외)')
    assert(sumA.find(s => s.allocatedSiteId === SITE_A.id)?.totalDays === 1, 'A현장 노임합계 투입일수 = 1')

    // 엑셀 A건 = 집계 A건
    const excelIncludedA = rowsA.filter(r => r.includeInLabor).length
    assert(excelIncludedA === includedA, '엑셀 A현장 포함 건수 = 화면 포함 건수 (일치)')

    // B현장 포함 건수 일치
    const includedB = rowsB.filter(r => r.includeInLabor).length
    const sumB = summarizeLabor(rowsB)
    assert(includedB === 1,              'B현장 포함 건수 = 1')
    assert(sumB.find(s => s.allocatedSiteId === SITE_B.id)?.totalDays === 1, 'B현장 노임합계 투입일수 = 1')
  })

  // ─────────────────────────────────────────────────────────────────
  scenario('시나리오 6 — 합계 검증 (화면 숫자 = 엑셀 숫자)', () => {
    const { SITE_A, SITE_B, W1, W2, D1, D2, ADMIN_ID } = setupFixtures()
    const yest = yesterday()

    // COMPLETED 2건: W1 A현장, W2 B현장(이동)
    checkIn(W1.id, D1.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    checkOut(W1.id, D1.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    checkIn(W2.id, D2.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    move(W2.id, D2.deviceToken, SITE_B.qrToken, INSIDE_B.lat, INSIDE_B.lng)
    checkOut(W2.id, D2.deviceToken, SITE_B.qrToken, INSIDE_B.lat, INSIDE_B.lng)

    // MISSING_CHECKOUT 1건: W1 전일
    const mcLog: AttendanceLog = {
      id: DB.id(), workerId: W1.id, siteId: SITE_A.id, checkOutSiteId: null,
      workDate: yest, checkInAt: new Date(`${yest}T08:00:00+09:00`), checkOutAt: null,
      checkInDistance: 28, checkOutDistance: null, status: 'MISSING_CHECKOUT',
      adminNote: '[AUTO] ...', qrToken: SITE_A.qrToken,
    }
    DB.logs.push(mcLog)

    // ADJUSTED 1건: W2 전일 (수동 보정)
    const adjLog: AttendanceLog = {
      id: DB.id(), workerId: W2.id, siteId: SITE_B.id, checkOutSiteId: null,
      workDate: yest, checkInAt: new Date(`${yest}T09:00:00+09:00`),
      checkOutAt: new Date(`${yest}T17:00:00+09:00`),
      checkInDistance: 44, checkOutDistance: 44, status: 'ADJUSTED',
      adminNote: '관리자 보정: 17:00 퇴근', qrToken: SITE_B.qrToken,
    }
    DB.logs.push(adjLog)
    DB.audits.push({
      id: DB.id(), adminId: ADMIN_ID, actionType: 'ADJUST_ATTENDANCE',
      targetType: 'AttendanceLog', targetId: adjLog.id,
      description: `보정: ${W2.name}`, createdAt: new Date(),
    })

    const rows    = aggregateLabor(yest, TODAY)
    const summary = summarizeLabor(rows)

    // ── 집계 화면 숫자 계산 ──
    const screenTotal       = rows.length
    const screenIncluded    = rows.filter(r => r.includeInLabor).length
    const screenNeedsReview = rows.filter(r => r.needsReview).length
    const screenAuto        = rows.filter(r => r.isAutoCheckout).length
    const screenAdjusted    = rows.filter(r => r.isAdjusted).length

    console.log(c.dim(`집계 화면: 전체=${screenTotal} 포함=${screenIncluded} 검토필요=${screenNeedsReview} AUTO=${screenAuto} 보정=${screenAdjusted}`))
    assert(screenTotal === 4,       '전체 건수 = 4')
    assert(screenIncluded === 3,    '포함 건수 = 3 (COMPLETED×2 + ADJUSTED×1)')
    assert(screenNeedsReview === 1, '검토 필요 = 1 (MISSING_CHECKOUT)')
    assert(screenAuto === 1,        'AUTO 건수 = 1 (MISSING_CHECKOUT)')
    assert(screenAdjusted === 1,    '보정 건수 = 1 (ADJUSTED)')

    // ── 엑셀 시트2 숫자 계산 ──
    const excelTotalDays    = summary.reduce((s, r) => s + r.totalDays, 0)
    const excelAdjustedDays = summary.reduce((s, r) => s + r.adjustedDays, 0)
    const excelReviewDays   = summary.reduce((s, r) => s + r.needsReviewDays, 0)

    console.log(c.dim(`엑셀 시트2: 투입일수합=${excelTotalDays} 보정건수합=${excelAdjustedDays} 검토건수합=${excelReviewDays}`))
    assert(excelTotalDays    === 3, '엑셀 시트2 투입일수 합계 = 3 (포함 건만)')
    assert(excelAdjustedDays === 1, '엑셀 시트2 보정 건수 = 1')
    assert(excelReviewDays   === 1, '엑셀 시트2 검토 필요 = 1')

    // ── 화면 ↔ 엑셀 일치 검증 ──
    assert(screenIncluded    === excelTotalDays,    '화면 포함 건수 = 엑셀 투입일수 합계 (일치)')
    assert(screenAdjusted    === excelAdjustedDays, '화면 보정 건수 = 엑셀 보정 건수 (일치)')
    assert(screenNeedsReview === excelReviewDays,   '화면 검토 필요 = 엑셀 검토 건수 (일치)')

    // ADJUSTED 인정 시간: 09:00~17:00 = 480분
    const adjRow = rows.find(r => r.status === 'ADJUSTED')
    assert(adjRow?.totalWorkedMinutes === 480, `ADJUSTED 인정시간 = 480분 (09:00~17:00) → ${fmtMin(adjRow?.totalWorkedMinutes ?? null)}`)
  })

  // ─────────────────────────────────────────────────────────────────
  console.log(c.head('\n── 예외 시나리오 ────────────────────────────────────────'))

  scenario('예외 5.1 — 미승인 기기 차단', () => {
    const { SITE_A, W1, UNAPPROVED_TOKEN } = setupFixtures()
    const r = checkIn(W1.id, UNAPPROVED_TOKEN, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    assert(r.success === false,            '미승인 기기 출근 → 차단')
    assert(DB.logs.length === 0,           '원천 기록 생성 안 됨')
  })

  scenario('예외 5.2 — GPS 반경 이탈 차단', () => {
    const { SITE_A, W1, D1 } = setupFixtures()
    const r = checkIn(W1.id, D1.deviceToken, SITE_A.qrToken, OUTSIDE.lat, OUTSIDE.lng)
    const dist = Math.round(haversineDistance(OUTSIDE.lat, OUTSIDE.lng, SITE_A_LAT, SITE_A_LNG))
    console.log(c.dim(`GPS 이탈 거리: ${dist}m`))
    assert(r.success === false,            `GPS 이탈 출근 → 차단 (거리 ${dist}m)`)
    assert(DB.logs.length === 0,           '원천 기록 생성 안 됨')
  })

  scenario('예외 5.3 — 재퇴근 차단', () => {
    const { SITE_A, W1, D1 } = setupFixtures()
    checkIn(W1.id, D1.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    checkOut(W1.id, D1.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    const r2 = checkOut(W1.id, D1.deviceToken, SITE_A.qrToken, INSIDE_A.lat, INSIDE_A.lng)
    assert(r2.success === false, '퇴근 완료 후 재퇴근 → 차단')
    assert(r2.message === '출근 기록 없음', '오류 메시지: 출근 기록 없음')
  })

  scenario('예외 5.4 — 자동퇴근 중복 실행 방지', () => {
    const { SITE_A, W1 } = setupFixtures()
    const yest = yesterday()
    DB.logs.push({
      id: DB.id(), workerId: W1.id, siteId: SITE_A.id, checkOutSiteId: null,
      workDate: yest, checkInAt: new Date(`${yest}T08:00:00+09:00`), checkOutAt: null,
      checkInDistance: 30, checkOutDistance: null, status: 'WORKING',
      adminNote: null, qrToken: SITE_A.qrToken,
    })
    const r1 = runAutoCheckout(TODAY)
    const r2 = runAutoCheckout(TODAY)
    console.log(c.dim(`1회차: processed=${r1.processed}  2회차: totalFound=${r2.totalFound}`))
    assert(r1.processed === 1,   '1회차 1건 처리')
    assert(r2.totalFound === 0,  '2회차 대상 0건 (이미 MISSING_CHECKOUT)')
    assert(r2.processed  === 0,  '2회차 처리 0건')
  })

  scenario('예외 5.5 — 보정 후 즉시 재집계 반영', () => {
    const { SITE_A, W1, ADMIN_ID } = setupFixtures()
    const yest = yesterday()
    const log: AttendanceLog = {
      id: DB.id(), workerId: W1.id, siteId: SITE_A.id, checkOutSiteId: null,
      workDate: yest, checkInAt: new Date(`${yest}T08:00:00+09:00`), checkOutAt: null,
      checkInDistance: 30, checkOutDistance: null, status: 'MISSING_CHECKOUT',
      adminNote: '[AUTO] ...', qrToken: SITE_A.qrToken,
    }
    DB.logs.push(log)

    // 보정 전 집계
    const before = aggregateLabor(yest, yest)
    assert(before[0].includeInLabor === false, '보정 전 집계 포함 = 제외')

    // 보정 실행
    adminPatchAttendance(log.id, ADMIN_ID, {
      checkOutAt: `${yest}T17:30:00+09:00`,
      status: 'ADJUSTED',
      adminNote: '보정 완료',
    })

    // 즉시 재집계 (실시간 집계이므로 캐시 없음)
    const after = aggregateLabor(yest, yest)
    assert(after[0].includeInLabor === true,  '보정 후 즉시 집계 포함 = 포함')
    assert(after[0].totalWorkedMinutes === 570, `인정시간 = 570분 (08:00~17:30) → ${fmtMin(after[0].totalWorkedMinutes)}`)
    assert(DB.audits.length === 1,             '감사 로그 즉시 기록됨')
  })

  // ─────────────────────────────────────────────────────────────────
  // 최종 결과
  console.log(c.head('\n╔═══════════════════════════════════════════════════════╗'))
  const allPass = failed === 0
  const badge = allPass ? '\x1b[32m[ PASS ]\x1b[0m' : '\x1b[31m[ FAIL ]\x1b[0m'
  console.log(`  결과: ${badge}`)
  console.log(`  시나리오: \x1b[32m${scenarioPassed}통과\x1b[0m / \x1b[31m${scenarioFailed}실패\x1b[0m`)
  console.log(`  단위검증: \x1b[32m${passed}통과\x1b[0m / \x1b[31m${failed}실패\x1b[0m`)
  console.log(c.head('╚═══════════════════════════════════════════════════════╝\n'))

  // 보고서
  console.log(c.head('[ 파이프라인 점검 보고서 ]'))
  const reportRows: [string, string][] = [
    ['시나리오 1 — 동일현장 출퇴근', `COMPLETED → 집계 포함, 인정현장=A, 인정시간 정상`],
    ['시나리오 2 — A출근→B이동→B퇴근', `인정현장=B, 엑셀 시트1 이동표시, 시트2 B기준 합산`],
    ['시나리오 3 — 퇴근누락 자동퇴근', `MISSING_CHECKOUT, checkOutAt=null, 집계 제외, AUTO 태그`],
    ['시나리오 4 — 수동보정 ADJUSTED', `보정 후 집계 포함, 인정시간=600분, 감사로그 기록`],
    ['시나리오 5 — 현장필터 일관성', `인정현장 기준 필터: 화면/집계/엑셀 건수 일치`],
    ['시나리오 6 — 합계 수치 일치', `화면 포함건=엑셀 투입일수, 화면 검토건=엑셀 검토건`],
    ['예외 — 미승인기기 차단', `원천 기록 미생성`],
    ['예외 — GPS 이탈 차단', `원천 기록 미생성`],
    ['예외 — 재퇴근 차단', `정상 차단`],
    ['예외 — 자동퇴근 중복실행', `2회차 totalFound=0`],
    ['예외 — 보정 즉시 재집계', `실시간 집계이므로 즉시 반영`],
  ]
  for (const [k, v] of reportRows) {
    console.log(`  ${k.padEnd(28)} ${v}`)
  }
  console.log()

  process.exit(failed > 0 ? 1 : 0)
}

run()
