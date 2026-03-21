import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { unauthorized, notFound, internalError } from '@/lib/utils/response'
import { createFilingExport, ExportType } from '@/lib/labor/filing-export'

// GET /api/admin/filing-exports/:id/download
// 저장된 export 기록 기반으로 CSV 재생성 후 다운로드
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const record = await prisma.filingExport.findUnique({ where: { id: params.id } })
    if (!record) return notFound('NOT_FOUND')

    // 재생성
    const result = await createFilingExport({
      monthKey:   record.monthKey,
      exportType: record.exportType as ExportType,
      createdBy:  session.sub,
    })

    if (result.rows.length === 0) {
      return new NextResponse('데이터 없음', { status: 204 })
    }

    // CSV 생성
    const headers = Object.keys(result.rows[0])
    const csvRows = [
      headers.join(','),
      ...result.rows.map((row) =>
        headers.map((h) => {
          const v = row[h]
          const s = v == null ? '' : String(v)
          return s.includes(',') ? `"${s}"` : s
        }).join(',')
      ),
    ]
    const csv = '\uFEFF' + csvRows.join('\r\n') // BOM for Excel

    const filename = `${record.exportType}_${record.monthKey}.csv`
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (err) {
    console.error('[filing-exports/download]', err)
    return internalError()
  }
}
