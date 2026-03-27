import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { geocodeAddress, sleep } from '@/lib/geocoding/geocode'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// ─── 컬럼 헤더 정규화 ───────────────────────────────────────
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s|\(|\)|m/g, '')
}

function extractColumns(headers: string[]): {
  nameCol: string | null; addressCol: string | null; radiusCol: string | null; codeCol: string | null
} {
  const nameKeys   = ['현장명', 'sitename', 'name', '이름']
  const addrKeys   = ['주소', '원본주소', 'address', 'rawaddress']
  const radiusKeys = ['허용반경', '반경', 'allowedradius', 'radius', '허용반경m']
  const codeKeys   = ['현장코드', 'sitecode', 'code', '코드']

  const find = (keys: string[]) => headers.find((h) => keys.includes(normalizeHeader(h))) ?? null
  return { nameCol: find(nameKeys), addressCol: find(addrKeys), radiusCol: find(radiusKeys), codeCol: find(codeKeys) }
}

// ─── GET /api/admin/site-imports — 작업 목록 ────────────────
export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const jobs = await prisma.bulkSiteImportJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        originalFilename: true,
        status: true,
        totalRows: true,
        readyRows: true,
        failedRows: true,
        approvedRows: true,
        importedRows: true,
        uploadedBy: true,
        createdAt: true,
      },
    })

    return ok({ items: jobs })
  } catch (err) {
    console.error('[site-imports GET]', err)
    return internalError()
  }
}

// ─── POST /api/admin/site-imports — 엑셀 업로드 + 파싱 + 지오코딩 ─
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return badRequest('파일이 없습니다.')

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls'].includes(ext)) {
      return badRequest('xlsx 또는 xls 파일만 업로드 가능합니다.')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } catch {
      return badRequest('엑셀 파일을 읽을 수 없습니다. 파일 형식을 확인하세요.')
    }

    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rawRows.length === 0) return badRequest('데이터 행이 없습니다.')
    if (rawRows.length > 200) return badRequest('한 번에 최대 200행까지 업로드 가능합니다.')

    const headers = Object.keys(rawRows[0])
    const { nameCol, addressCol, radiusCol, codeCol } = extractColumns(headers)
    if (!nameCol || !addressCol) {
      return badRequest(`필수 컬럼을 찾을 수 없습니다. '현장명'과 '주소' 컬럼이 있어야 합니다. (감지된 컬럼: ${headers.join(', ')})`)
    }

    // 중복 현장명 감지 (같은 파일 내)
    const nameCount: Record<string, number> = {}
    for (const row of rawRows) {
      const n = String(row[nameCol] ?? '').trim()
      if (n) nameCount[n] = (nameCount[n] ?? 0) + 1
    }

    // Job 생성 (상태 PROCESSING)
    const job = await prisma.bulkSiteImportJob.create({
      data: {
        uploadedBy: session.sub,
        originalFilename: file.name,
        status: 'PROCESSING',
        totalRows: rawRows.length,
      },
    })

    // 각 행 처리 (지오코딩 포함)
    let readyRows = 0, failedRows = 0

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i]
      const rowNumber = i + 2  // 엑셀은 헤더=1행, 데이터는 2행부터
      const siteName   = String(raw[nameCol] ?? '').trim()
      const rawAddress = String(raw[addressCol] ?? '').trim()
      const radiusRaw  = radiusCol ? raw[radiusCol] : null
      const allowedRadius = radiusRaw && !isNaN(Number(radiusRaw)) ? Math.round(Number(radiusRaw)) : null

      // 필수 값 검증
      if (!siteName) {
        await prisma.bulkSiteImportRow.create({
          data: {
            jobId: job.id, rowNumber, siteName: '(빈 현장명)', rawAddress,
            validationStatus: 'FAILED', validationMessage: '현장명이 비어 있습니다.',
          },
        })
        failedRows++; continue
      }
      if (!rawAddress) {
        await prisma.bulkSiteImportRow.create({
          data: {
            jobId: job.id, rowNumber, siteName, rawAddress: '',
            validationStatus: 'FAILED', validationMessage: '주소가 비어 있습니다.',
          },
        })
        failedRows++; continue
      }

      // 지오코딩 (Nominatim 사용 시 rate limit 준수)
      if (i > 0 && !process.env.KAKAO_REST_API_KEY) await sleep(1100)
      const geo = await geocodeAddress(rawAddress)

      if (!geo) {
        await prisma.bulkSiteImportRow.create({
          data: {
            jobId: job.id, rowNumber, siteName, rawAddress,
            allowedRadiusMeters: allowedRadius,
            validationStatus: 'FAILED',
            validationMessage: '주소 지오코딩 실패 — 좌표를 직접 입력하세요.',
          },
        })
        failedRows++; continue
      }

      // 검수 필요 조건 판단
      const issues: string[] = []
      if (!allowedRadius) issues.push('허용 반경 미입력')
      if (nameCount[siteName] > 1) issues.push('파일 내 현장명 중복 의심')
      if (geo.confidence === 'LOW') issues.push('지오코딩 정확도 낮음 (좌표 확인 필요)')

      const status = issues.length > 0 ? 'NEEDS_REVIEW' : 'READY'

      await prisma.bulkSiteImportRow.create({
        data: {
          jobId: job.id,
          rowNumber,
          siteName,
          rawAddress,
          normalizedAddress: geo.normalizedAddress,
          latitude: geo.latitude,
          longitude: geo.longitude,
          allowedRadiusMeters: allowedRadius ?? 100,
          validationStatus: status,
          validationMessage: issues.length > 0 ? issues.join(' / ') : null,
        },
      })

      if (status === 'READY') readyRows++
      else failedRows++  // NEEDS_REVIEW도 여기 포함 (통계용)
    }

    // 실제 readyRows/failedRows/needsReview 재집계
    const counts = await prisma.bulkSiteImportRow.groupBy({
      by: ['validationStatus'],
      where: { jobId: job.id },
      _count: { _all: true },
    })
    const countMap: Record<string, number> = {}
    for (const c of counts) countMap[c.validationStatus] = c._count._all

    await prisma.bulkSiteImportJob.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        readyRows: countMap['READY'] ?? 0,
        failedRows: (countMap['FAILED'] ?? 0) + (countMap['NEEDS_REVIEW'] ?? 0),
        approvedRows: 0,
        importedRows: 0,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'SITE_IMPORT_UPLOAD',
      targetType: 'BulkSiteImportJob',
      targetId: job.id,
      summary: `현장 엑셀 업로드: ${file.name} (${rawRows.length}행)`,
      metadataJson: { filename: file.name, totalRows: rawRows.length, readyRows: countMap['READY'] ?? 0 },
    })

    return created({ jobId: job.id }, `업로드 완료: ${rawRows.length}행 처리됨`)
  } catch (err) {
    console.error('[site-imports POST]', err)
    return internalError()
  }
}
