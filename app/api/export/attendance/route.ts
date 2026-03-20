import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { kstDateStringToDate, toKSTTimeString } from '@/lib/utils/date'
import { unauthorized, badRequest, internalError } from '@/lib/utils/response'
import * as XLSX from 'xlsx'

const STATUS_LABEL: Record<string, string> = {
  WORKING: '근무중',
  COMPLETED: '완료',
  EXCEPTION: '예외',
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const siteId = searchParams.get('siteId')

    if (!dateFrom || !dateTo) {
      return badRequest('dateFrom, dateTo 파라미터가 필요합니다.')
    }

    const where: Record<string, unknown> = {
      workDate: {
        gte: kstDateStringToDate(dateFrom),
        lte: kstDateStringToDate(dateTo),
      },
    }
    if (siteId) where.siteId = siteId

    const logs = await prisma.attendanceLog.findMany({
      where,
      include: {
        worker: { select: { name: true, phone: true, company: true, jobTitle: true } },
        checkInSite: { select: { name: true } },
      },
      orderBy: [{ workDate: 'asc' }, { checkInAt: 'asc' }],
    })

    const rows = logs.map((l) => ({
      날짜: l.workDate.toISOString().slice(0, 10),
      현장명: l.checkInSite.name,
      이름: l.worker.name,
      연락처: l.worker.phone,
      회사: l.worker.company,
      직종: l.worker.jobTitle,
      출근시각: l.checkInAt ? toKSTTimeString(l.checkInAt) : '',
      퇴근시각: l.checkOutAt ? toKSTTimeString(l.checkOutAt) : '',
      출근거리m: l.checkInDistance ?? '',
      퇴근거리m: l.checkOutDistance ?? '',
      상태: STATUS_LABEL[l.status] ?? l.status,
      예외사유: l.exceptionReason ?? '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '출퇴근기록')

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 8 }, { wch: 30 },
    ]

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `출퇴근기록_${dateFrom}_${dateTo}.xlsx`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (err) {
    console.error('[export/attendance]', err)
    return internalError()
  }
}
