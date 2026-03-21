/**
 * GET /api/export/labor
 *
 * 노임서류 엑셀 내보내기 (2개 시트)
 *   시트1: 투입현황 (상세)
 *   시트2: 노임집계 (근로자별 합계)
 *
 * Query: dateFrom, dateTo, siteId?, workerId?, onlyIncluded?
 */
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminSession } from '@/lib/auth/guards'
import { badRequest, unauthorized, internalError } from '@/lib/utils/response'
import {
  aggregateLaborAllocations,
  summarizeLaborAllocations,
  formatMinutes,
} from '@/lib/labor/aggregate'
import { toKSTTimeString } from '@/lib/utils/date'

const STATUS_LABEL: Record<string, string> = {
  COMPLETED:        '완료',
  ADJUSTED:         '보정',
  MISSING_CHECKOUT: '미퇴근',
  EXCEPTION:        '예외',
  ADMIN_MANUAL:     '수동등록',
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const dateFrom     = searchParams.get('dateFrom')
    const dateTo       = searchParams.get('dateTo')
    const siteId   = searchParams.get('siteId') ?? undefined
    const workerId = searchParams.get('workerId') ?? undefined

    if (!dateFrom || !dateTo) return badRequest('dateFrom, dateTo 파라미터가 필요합니다.')

    // 엑셀 내보내기는 전체 행 포함 — 집계포함/제외 여부는 컬럼으로 표시
    const rows   = await aggregateLaborAllocations({ dateFrom, dateTo, siteId, workerId, onlyIncluded: false })
    const summary = summarizeLaborAllocations(rows)

    const generatedAt = toKSTTimeString(new Date())
    const generatedDate = new Date().toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const footerNote = [
      `생성일시: ${generatedDate} ${generatedAt}`,
      `집계기간: ${dateFrom} ~ ${dateTo}`,
      `포함 상태: COMPLETED / ADJUSTED`,
      `미퇴근(MISSING_CHECKOUT) 포함여부: 별도 표시`,
    ].join('  |  ')

    const wb = XLSX.utils.book_new()

    // ── 시트1: 투입현황 (상세) ───────────────────────────────────────
    const detailRows = rows.map((r) => ({
      날짜: r.workDate,
      근로자명: r.workerName,
      연락처: r.workerPhone,
      소속: r.company,
      직종: r.jobTitle,
      출근현장: r.checkInSiteName,
      이동여부: r.hasMove ? '이동있음' : '-',
      최종현장: r.lastSiteName,
      인정현장: r.allocatedSiteName,
      출근시각: r.checkInAt ?? '-',
      퇴근시각: r.checkOutAt ?? '-',
      인정시간: formatMinutes(r.totalWorkedMinutes),
      상태: STATUS_LABEL[r.status] ?? r.status,
      보정: r.isAdjusted ? '보정' : '',
      자동처리: r.isAutoCheckout ? 'AUTO' : '',
      집계포함: r.includeInLabor ? '포함' : (r.needsReview ? '검토필요' : '제외'),
      비고: r.adminNote ?? '',
    }))
    detailRows.push({ 날짜: footerNote } as typeof detailRows[0])

    const ws1 = XLSX.utils.json_to_sheet(detailRows)
    ws1['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 10 },
      { wch: 18 }, { wch: 8 }, { wch: 18 }, { wch: 18 },
      { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 30 },
    ]
    XLSX.utils.book_append_sheet(wb, ws1, '투입현황')

    // ── 시트2: 노임집계 (근로자별 합계) ─────────────────────────────
    const summaryRows = summary.map((s) => ({
      인정현장: s.allocatedSiteName,
      근로자명: s.workerName,
      소속: s.company,
      직종: s.jobTitle,
      투입일수: s.totalDays,
      인정시간: formatMinutes(s.totalMinutes),
      인정분: s.totalMinutes,
      보정건수: s.adjustedDays > 0 ? s.adjustedDays : '',
      자동처리: s.autoCheckoutDays > 0 ? s.autoCheckoutDays : '',
      검토필요: s.needsReviewDays > 0 ? s.needsReviewDays : '',
      단가: '',    // 단가 입력란 (빈칸 — 운영자 입력)
      노임합계: '',
      비고: s.adjustedDays > 0 ? '보정있음' : (s.needsReviewDays > 0 ? '검토필요건포함' : ''),
    }))
    summaryRows.push({ 인정현장: footerNote } as typeof summaryRows[0])

    const ws2 = XLSX.utils.json_to_sheet(summaryRows)
    ws2['!cols'] = [
      { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 8 },
      { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 10 }, { wch: 10 }, { wch: 20 },
    ]
    XLSX.utils.book_append_sheet(wb, ws2, '노임집계')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `노임서류_${dateFrom}_${dateTo}.xlsx`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (err) {
    console.error('[export/labor]', err)
    return internalError()
  }
}
