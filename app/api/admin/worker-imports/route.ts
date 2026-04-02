/**
 * POST /api/admin/worker-imports
 * 근로자 엑셀 일괄 업로드
 *
 * 필수 컬럼: 이름, 연락처, 직종
 * 선택 컬럼: 소속, 고용형태, 생년월일, 외국인여부, 숙련도, 비고
 *
 * 행별 검증 → 성공 행만 즉시 등록 → 실패 행은 사유와 함께 반환
 */
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

// ─── 컬럼 헤더 정규화 ───────────────────────────────────────
function norm(h: string): string {
  return h.trim().toLowerCase().replace(/\s/g, '')
}

function findCol(headers: string[], keys: string[]): string | null {
  return headers.find(h => keys.includes(norm(h))) ?? null
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
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

    // 기존 전화번호 목록 (중복 감지용)
    const existingPhones = new Set(
      (await prisma.worker.findMany({ select: { phone: true } }))
        .map(w => w.phone)
        .filter(Boolean) as string[]
    )

    // 파일 내 중복 감지
    const filePhones: Record<string, number[]> = {}
    for (let i = 0; i < rawRows.length; i++) {
      const p = normalizePhone(String(rawRows[i][phoneCol] ?? ''))
      if (p) {
        if (!filePhones[p]) filePhones[p] = []
        filePhones[p].push(i + 2) // 엑셀 행번호
      }
    }

    const results: Array<{
      row: number
      name: string
      phone: string
      status: 'success' | 'failed' | 'duplicate_warning'
      message: string
      workerId?: string
    }> = []

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i]
      const rowNum = i + 2
      const name = String(raw[nameCol] ?? '').trim()
      const phoneRaw = String(raw[phoneCol] ?? '').trim()
      const jobTitle = String(raw[jobCol] ?? '').trim()

      // 필수 검증
      if (!name) {
        results.push({ row: rowNum, name: '', phone: phoneRaw, status: 'failed', message: '이름이 비어 있습니다.' })
        failCount++; continue
      }
      if (!phoneRaw) {
        results.push({ row: rowNum, name, phone: '', status: 'failed', message: '연락처가 비어 있습니다.' })
        failCount++; continue
      }
      if (!jobTitle) {
        results.push({ row: rowNum, name, phone: phoneRaw, status: 'failed', message: '직종이 비어 있습니다.' })
        failCount++; continue
      }

      const phone = normalizePhone(phoneRaw)
      if (!/^010\d{8}$/.test(phone)) {
        results.push({ row: rowNum, name, phone: phoneRaw, status: 'failed', message: '010으로 시작하는 11자리 번호가 아닙니다.' })
        failCount++; continue
      }

      // 중복 검사
      if (existingPhones.has(phone)) {
        results.push({ row: rowNum, name, phone, status: 'failed', message: '이미 등록된 전화번호입니다.' })
        failCount++; continue
      }

      // 파일 내 중복
      if (filePhones[phone] && filePhones[phone].length > 1) {
        const otherRows = filePhones[phone].filter(r => r !== rowNum)
        results.push({ row: rowNum, name, phone, status: 'failed', message: `파일 내 중복 전화번호 (${otherRows.join(',')}행과 동일)` })
        failCount++; continue
      }

      // 선택 필드 파싱
      const empTypeRaw = empTypeCol ? String(raw[empTypeCol] ?? '').trim().toLowerCase() : ''
      const employmentType = EMPLOYMENT_TYPE_MAP[empTypeRaw] ?? 'DAILY_CONSTRUCTION'

      const orgRaw = orgCol ? String(raw[orgCol] ?? '').trim().toLowerCase() : ''
      const organizationType = ORG_TYPE_MAP[orgRaw] ?? 'DIRECT'

      let birthDate: string | null = null
      if (birthCol) {
        const bd = String(raw[birthCol] ?? '').replace(/\D/g, '')
        if (/^\d{8}$/.test(bd)) birthDate = bd
      }

      const foreignerYn = foreignCol
        ? ['y', 'yes', '예', 'o', '1', 'true', '외국인'].includes(String(raw[foreignCol] ?? '').trim().toLowerCase())
        : false

      const skillLevel = skillCol ? String(raw[skillCol] ?? '').trim() || null : null
      const subcontractorName = subconCol ? String(raw[subconCol] ?? '').trim() || null : null

      // 등록
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
            birthDate,
            subcontractorName: organizationType === 'SUBCONTRACTOR' ? subcontractorName : null,
          },
        })

        existingPhones.add(phone) // 이후 행 중복 방지
        results.push({ row: rowNum, name, phone, status: 'success', message: '등록 완료', workerId: worker.id })
        successCount++
      } catch (err) {
        const msg = (err as Error).message
        if (msg.includes('Unique constraint')) {
          results.push({ row: rowNum, name, phone, status: 'failed', message: '전화번호 중복 (동시 등록 충돌)' })
        } else {
          results.push({ row: rowNum, name, phone, status: 'failed', message: `DB 오류: ${msg.slice(0, 80)}` })
        }
        failCount++
      }
    }

    // 감사 로그
    writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role ?? undefined,
      actionType: 'WORKER_IMPORT_UPLOAD',
      summary: `근로자 엑셀 업로드: ${file.name} (${rawRows.length}행 → 성공 ${successCount} / 실패 ${failCount})`,
      metadataJson: { filename: file.name, totalRows: rawRows.length, successCount, failCount },
    })

    return ok({
      totalRows: rawRows.length,
      successCount,
      failCount,
      results,
    })
  } catch (err) {
    console.error('[worker-imports POST]', err)
    return internalError()
  }
}
