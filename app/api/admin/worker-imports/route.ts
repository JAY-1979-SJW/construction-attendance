/**
 * POST /api/admin/worker-imports — 근로자 엑셀 업로드 + 중복 판정
 * GET  /api/admin/worker-imports — 작업 목록
 *
 * OK 건: 즉시 등록
 * REVIEW/BLOCK 건: 스테이징 후 사용자 확인
 */
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { Prisma } from '@prisma/client'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, created, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { normalizePhone, normalizeName, normalizeBirthDate } from '@/lib/dedupe/normalize'
import { loadExistingWorkers, classifyWorker, detectInFileDuplicates } from '@/lib/dedupe/worker'

// ─── 컬럼 헤더 정규화 ─────────────────────────────────────
function norm(h: string): string {
  return h.trim().toLowerCase().replace(/\s/g, '')
}
function findCol(headers: string[], keys: string[]): string | null {
  return headers.find(h => keys.includes(norm(h))) ?? null
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  '일용': 'DAILY_CONSTRUCTION', '일용직': 'DAILY_CONSTRUCTION', '건설일용': 'DAILY_CONSTRUCTION',
  '정규': 'REGULAR', '정규직': 'REGULAR', '상용': 'REGULAR', '상용직': 'REGULAR',
  '사업소득': 'BUSINESS_33', '3.3%': 'BUSINESS_33', '프리랜서': 'BUSINESS_33',
  '기간제': 'FIXED_TERM', '계약직': 'FIXED_TERM',
  '상주': 'CONTINUOUS_SITE', '현장상주': 'CONTINUOUS_SITE',
  '기타': 'OTHER',
}

const ORG_TYPE_MAP: Record<string, string> = {
  '직접': 'DIRECT', '직영': 'DIRECT', '직고용': 'DIRECT',
  '외주': 'SUBCONTRACTOR', '협력사': 'SUBCONTRACTOR', '하도급': 'SUBCONTRACTOR', '하청': 'SUBCONTRACTOR',
}

// ─── GET ─────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const jobs = await prisma.bulkWorkerImportJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        originalFilename: true,
        status: true,
        totalRows: true,
        okRows: true,
        reviewRows: true,
        blockRows: true,
        failedRows: true,
        importedRows: true,
        uploadedBy: true,
        createdAt: true,
      },
    })

    return ok({ items: jobs })
  } catch (err) {
    console.error('[worker-imports GET]', err)
    return internalError()
  }
}

// ─── POST ────────────────────────────────────────────────
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
      return badRequest('엑셀 파일을 읽을 수 없습니다.')
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rawRows.length === 0) return badRequest('데이터 행이 없습니다.')
    if (rawRows.length > 200) return badRequest('한 번에 최대 200행까지 업로드 가능합니다.')

    const headers = Object.keys(rawRows[0])
    const nameCol = findCol(headers, ['이름', '성명', 'name', '근로자명', '근로자'])
    const phoneCol = findCol(headers, ['연락처', '전화번호', '핸드폰', '휴대폰', 'phone', '전화', '연락처(필수)'])
    const jobCol = findCol(headers, ['직종', '업무', 'jobtitle', 'job', '직무', '공종'])

    if (!nameCol || !phoneCol || !jobCol) {
      return badRequest(
        `필수 컬럼을 찾을 수 없습니다. '이름', '연락처', '직종' 컬럼이 필요합니다. (감지된 컬럼: ${headers.join(', ')})`
      )
    }

    // 선택 컬럼
    const orgCol = findCol(headers, ['소속', '소속구분', '조직구분', 'organization', '소속유형'])
    const empTypeCol = findCol(headers, ['고용형태', '계약유형', 'employmenttype', '유형', '근로형태'])
    const birthCol = findCol(headers, ['생년월일', '생일', 'birthdate', 'birth', '주민앞자리'])
    const foreignCol = findCol(headers, ['외국인', '외국인여부', 'foreigner', 'foreign'])
    const skillCol = findCol(headers, ['숙련도', '등급', 'skilllevel', 'skill', '기능등급'])
    const subconCol = findCol(headers, ['협력사', '하도급사', '외주사', 'subcontractor', '협력업체'])
    const noteCol = findCol(headers, ['비고', 'note', 'notes', 'memo', '메모'])

    // 기존 근로자 로드 (1회)
    const existingWorkers = await loadExistingWorkers()

    // 파일 내 중복 감지
    const phoneEntries = rawRows.map((row, i) => ({
      rowIndex: i,
      phone: String(row[phoneCol] ?? ''),
    }))
    const inFileDupes = detectInFileDuplicates(phoneEntries)

    // Job 생성
    const job = await prisma.bulkWorkerImportJob.create({
      data: {
        uploadedBy: session.sub,
        originalFilename: file.name,
        status: 'PROCESSING',
        totalRows: rawRows.length,
      },
    })

    let autoInsertedCount = 0

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i]
      const rowNumber = i + 2
      const name = String(raw[nameCol] ?? '').trim()
      const phoneRaw = String(raw[phoneCol] ?? '').trim()
      const jobTitle = String(raw[jobCol] ?? '').trim()

      // 필수 검증
      if (!name || !phoneRaw || !jobTitle) {
        const missing = [!name && '이름', !phoneRaw && '연락처', !jobTitle && '직종'].filter(Boolean).join(', ')
        await prisma.bulkWorkerImportRow.create({
          data: {
            jobId: job.id, rowNumber, name: name || '(비어있음)', phone: phoneRaw, jobTitle: jobTitle || '',
            dedupeStatus: 'PENDING',
            validationStatus: 'FAILED',
            validationMessage: `필수 항목 누락: ${missing}`,
          },
        })
        continue
      }

      const phone = normalizePhone(phoneRaw)
      if (!/^010\d{8}$/.test(phone)) {
        await prisma.bulkWorkerImportRow.create({
          data: {
            jobId: job.id, rowNumber, name, phone: phoneRaw, jobTitle,
            normalizedPhone: phone,
            dedupeStatus: 'PENDING',
            validationStatus: 'FAILED',
            validationMessage: '010으로 시작하는 11자리 번호가 아닙니다.',
          },
        })
        continue
      }

      // 파일 내 중복 체크
      if (inFileDupes.has(i)) {
        const otherRows = inFileDupes.get(i)!.map(r => r + 2)
        await prisma.bulkWorkerImportRow.create({
          data: {
            jobId: job.id, rowNumber, name, phone, jobTitle,
            normalizedPhone: phone,
            normalizedName: normalizeName(name),
            dedupeStatus: 'BLOCK',
            dedupeReason: `파일 내 전화번호 중복 (${otherRows.join(',')}행과 동일)`,
            validationStatus: 'NEEDS_REVIEW',
            validationMessage: `파일 내 전화번호 중복 (${otherRows.join(',')}행)`,
          },
        })
        continue
      }

      // 선택 필드 파싱
      const empTypeRaw = empTypeCol ? String(raw[empTypeCol] ?? '').trim().toLowerCase() : ''
      const employmentType = EMPLOYMENT_TYPE_MAP[empTypeRaw] ?? 'DAILY_CONSTRUCTION'
      const orgRaw = orgCol ? String(raw[orgCol] ?? '').trim().toLowerCase() : ''
      const organizationType = ORG_TYPE_MAP[orgRaw] ?? 'DIRECT'

      let birthDate: string | null = null
      if (birthCol) {
        const bd = String(raw[birthCol] ?? '').replace(/\D/g, '')
        if (/^\d{6,8}$/.test(bd)) birthDate = normalizeBirthDate(bd)
      }

      const foreignerYn = foreignCol
        ? ['y', 'yes', '예', 'o', '1', 'true', '외국인'].includes(String(raw[foreignCol] ?? '').trim().toLowerCase())
        : false
      const skillLevel = skillCol ? String(raw[skillCol] ?? '').trim() || null : null
      const subcontractorName = subconCol ? String(raw[subconCol] ?? '').trim() || null : null
      const note = noteCol ? String(raw[noteCol] ?? '').trim() || null : null

      // DB 기존 근로자와 중복 비교
      const dedupe = classifyWorker(
        { name, phone: phoneRaw, birthDate },
        existingWorkers,
      )

      const normPhoneVal = normalizePhone(phoneRaw)
      const normNameVal = normalizeName(name)
      const normBirthVal = birthDate ? normalizeBirthDate(birthDate) : null

      if (dedupe.status === 'OK') {
        // 즉시 등록
        try {
          const worker = await prisma.worker.create({
            data: {
              name,
              phone,
              jobTitle,
              employmentType: employmentType as never,
              organizationType: organizationType as never,
              foreignerYn,
              nationalityCode: foreignerYn ? null : 'KR',
              skillLevel,
              birthDate: birthDate ?? undefined,
              subcontractorName: organizationType === 'SUBCONTRACTOR' ? subcontractorName : null,
            },
          })

          await prisma.bulkWorkerImportRow.create({
            data: {
              jobId: job.id, rowNumber, name, phone, jobTitle,
              employmentType, organizationType, birthDate, foreignerYn, skillLevel, subcontractorName, note,
              normalizedPhone: normPhoneVal, normalizedName: normNameVal, normalizedBirth: normBirthVal,
              dedupeStatus: 'OK',
              dedupeReason: dedupe.reason,
              validationStatus: 'IMPORTED',
              validationMessage: '즉시 등록 (중복 없음)',
              importedWorkerId: worker.id,
            },
          })

          // 이후 행 비교용으로 새 등록 근로자도 추가
          existingWorkers.push({
            id: worker.id, name, phone, birthDate, jobTitle, isActive: true,
          })

          autoInsertedCount++
        } catch (err) {
          const msg = (err as Error).message
          await prisma.bulkWorkerImportRow.create({
            data: {
              jobId: job.id, rowNumber, name, phone, jobTitle,
              employmentType, organizationType, birthDate, foreignerYn, skillLevel, subcontractorName, note,
              normalizedPhone: normPhoneVal, normalizedName: normNameVal, normalizedBirth: normBirthVal,
              dedupeStatus: 'OK',
              validationStatus: 'FAILED',
              validationMessage: msg.includes('Unique constraint')
                ? '전화번호 중복 (동시 등록 충돌)'
                : `DB 오류: ${msg.slice(0, 80)}`,
            },
          })
        }
      } else {
        // REVIEW 또는 BLOCK → 스테이징
        await prisma.bulkWorkerImportRow.create({
          data: {
            jobId: job.id, rowNumber, name, phone, jobTitle,
            employmentType, organizationType, birthDate, foreignerYn, skillLevel, subcontractorName, note,
            normalizedPhone: normPhoneVal, normalizedName: normNameVal, normalizedBirth: normBirthVal,
            dedupeStatus: dedupe.status,
            dedupeReason: dedupe.reason,
            matchedWorkerId: dedupe.matchedId,
            matchedWorkerName: dedupe.matchedName,
            candidatesJson: dedupe.candidates.length > 0
              ? dedupe.candidates as unknown as Prisma.InputJsonValue
              : undefined,
            validationStatus: 'NEEDS_REVIEW',
            validationMessage: `[${dedupe.status}] ${dedupe.reason}`,
          },
        })
      }
    }

    // 집계
    const counts = await prisma.bulkWorkerImportRow.groupBy({
      by: ['dedupeStatus'],
      where: { jobId: job.id },
      _count: { _all: true },
    })
    const statusCounts = await prisma.bulkWorkerImportRow.groupBy({
      by: ['validationStatus'],
      where: { jobId: job.id },
      _count: { _all: true },
    })

    const dedupeMap: Record<string, number> = {}
    for (const c of counts) dedupeMap[c.dedupeStatus] = c._count._all
    const statusMap: Record<string, number> = {}
    for (const c of statusCounts) statusMap[c.validationStatus] = c._count._all

    await prisma.bulkWorkerImportJob.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        okRows: dedupeMap['OK'] ?? 0,
        reviewRows: dedupeMap['REVIEW'] ?? 0,
        blockRows: dedupeMap['BLOCK'] ?? 0,
        failedRows: statusMap['FAILED'] ?? 0,
        importedRows: statusMap['IMPORTED'] ?? 0,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role ?? undefined,
      actionType: 'WORKER_IMPORT_UPLOAD',
      summary: `근로자 엑셀 업로드: ${file.name} (${rawRows.length}행 → 즉시등록 ${autoInsertedCount}, 검토필요 ${(dedupeMap['REVIEW'] ?? 0) + (dedupeMap['BLOCK'] ?? 0)})`,
      metadataJson: {
        filename: file.name, totalRows: rawRows.length,
        autoInserted: autoInsertedCount,
        review: dedupeMap['REVIEW'] ?? 0,
        block: dedupeMap['BLOCK'] ?? 0,
        failed: statusMap['FAILED'] ?? 0,
      },
    })

    return created(
      { jobId: job.id },
      `업로드 완료: ${rawRows.length}행 (즉시등록 ${autoInsertedCount}, 검토필요 ${(dedupeMap['REVIEW'] ?? 0) + (dedupeMap['BLOCK'] ?? 0)})`,
    )
  } catch (err) {
    console.error('[worker-imports POST]', err)
    return internalError()
  }
}
