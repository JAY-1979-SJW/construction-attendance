/**
 * GET /api/admin/print-center/daily-attendance
 * 일일 출퇴근 현황 출력 — HTML (브라우저 인쇄) 또는 JSON
 *
 * 권한: ADMIN 이상
 * 쿼리 파라미터:
 *  - date: 'YYYY-MM-DD' (필수)
 *  - siteId: 현장 필터 (선택)
 *  - format: 'html' | 'json' (기본: html)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { unauthorized, badRequest } from '@/lib/utils/response'
import { kstDateStringToDate } from '@/lib/utils/date'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtMinutes(m: number | null): string {
  if (m == null || m === 0) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  return h > 0 ? `${h}시간 ${min}분` : `${min}분`
}

const STATUS_LABEL: Record<string, string> = {
  WORKING:          '근무중',
  COMPLETED:        '완료',
  MISSING_CHECKOUT: '퇴근누락',
  ADJUSTED:         '수정완료',
  ADMIN_MANUAL:     '수동입력',
  EXCEPTION:        '예외',
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const roleErr = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
    if (roleErr) return roleErr

    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date')
    const siteId  = searchParams.get('siteId')
    const format  = searchParams.get('format') ?? 'html'

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return badRequest('date는 YYYY-MM-DD 형식이어야 합니다.')
    }

    const workDate = kstDateStringToDate(dateStr)

    const logs = await prisma.attendanceLog.findMany({
      where: {
        workDate,
        ...(siteId ? { siteId } : {}),
      },
      include: {
        worker:      { select: { name: true, phone: true } },
        checkInSite: { select: { name: true } },
      },
      orderBy: [{ checkInSite: { name: 'asc' } }, { checkInAt: 'asc' }],
    })

    const siteNameLabel = siteId
      ? logs[0]?.checkInSite?.name ?? '전체'
      : '전체'

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        date:    dateStr,
        siteName: siteNameLabel,
        total:   logs.length,
        items:   logs.map(l => ({
          workerName: l.worker.name,
          workerPhone: l.worker.phone,
          company:    l.companyNameSnapshot ?? '',
          siteName:   l.checkInSite.name,
          checkInAt:  l.checkInAt?.toISOString() ?? null,
          checkOutAt: l.checkOutAt?.toISOString() ?? null,
          status:     l.status,
        })),
      })
    }

    // HTML 출력
    const rows = logs.map(l => `
      <tr>
        <td>${esc(l.worker.name)}</td>
        <td>${esc(l.worker.phone)}</td>
        <td>${esc(l.companyNameSnapshot ?? '')}</td>
        <td>${esc(l.checkInSite.name)}</td>
        <td>${fmtTime(l.checkInAt?.toISOString() ?? null)}</td>
        <td>${fmtTime(l.checkOutAt?.toISOString() ?? null)}</td>
        <td class="status-${l.status.toLowerCase()}">${STATUS_LABEL[l.status] ?? l.status}</td>
      </tr>`).join('')

    const totalByStatus = logs.reduce((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <title>일일 출퇴근 현황 — ${dateStr}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11px; color: #222; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .title { font-size: 18px; font-weight: 800; }
    .meta { font-size: 11px; color: #666; text-align: right; }
    .summary { display: flex; gap: 20px; margin-bottom: 16px; flex-wrap: wrap; }
    .summary-item { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 14px; }
    .summary-item .label { font-size: 10px; color: #777; }
    .summary-item .value { font-size: 16px; font-weight: 800; color: #1565c0; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #263238; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; }
    td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; font-size: 11px; }
    tr:nth-child(even) td { background: #fafafa; }
    .status-completed { color: #2e7d32; font-weight: 700; }
    .status-working { color: #1565c0; font-weight: 700; }
    .status-missing_checkout { color: #e65100; font-weight: 700; }
    .status-exception { color: #c62828; font-weight: 700; }
    .status-adjusted { color: #6a1b9a; font-weight: 700; }
    .status-admin_manual { color: #555; }
    .footer { margin-top: 20px; font-size: 10px; color: #888; border-top: 1px solid #e0e0e0; padding-top: 8px; display: flex; justify-content: space-between; }
    @media print {
      .no-print { display: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">일일 출퇴근 현황</div>
      <div style="font-size:13px;color:#555;margin-top:4px">${esc(dateStr)} · ${esc(siteNameLabel)}</div>
    </div>
    <div class="meta">
      출력일시: ${new Date().toLocaleString('ko-KR')}<br>
      총 ${logs.length}건
    </div>
  </div>

  <div class="summary">
    <div class="summary-item"><div class="label">전체</div><div class="value">${logs.length}</div></div>
    <div class="summary-item"><div class="label">완료</div><div class="value" style="color:#2e7d32">${totalByStatus['COMPLETED'] ?? 0}</div></div>
    <div class="summary-item"><div class="label">근무중</div><div class="value" style="color:#1565c0">${totalByStatus['WORKING'] ?? 0}</div></div>
    <div class="summary-item"><div class="label">퇴근누락</div><div class="value" style="color:#e65100">${totalByStatus['MISSING_CHECKOUT'] ?? 0}</div></div>
    <div class="summary-item"><div class="label">예외</div><div class="value" style="color:#c62828">${totalByStatus['EXCEPTION'] ?? 0}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>이름</th><th>연락처</th><th>소속</th><th>현장</th>
        <th>출근</th><th>퇴근</th><th>상태</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">해당 날짜 출퇴근 기록이 없습니다.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <span>본 출력물은 운영 참고용이며 공식 서류가 아닙니다.</span>
    <span>출력자: ${esc(session.sub)}</span>
  </div>

  <div class="no-print" style="margin-top:20px;text-align:center">
    <button onclick="window.print()" style="padding:10px 24px;background:#1565c0;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-weight:700">
      인쇄 / PDF 저장
    </button>
  </div>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(`일일출퇴근_${dateStr}.html`)}`,
      },
    })
  } catch (err) {
    console.error('[GET /print-center/daily-attendance]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
