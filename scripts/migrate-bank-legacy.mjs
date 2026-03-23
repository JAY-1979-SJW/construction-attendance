/**
 * migrate-bank-legacy.mjs
 *
 * 레거시 Worker.bankName → WorkerBankAccountSecure.bankName 이행 스크립트
 *
 * 이행 원칙:
 *   - WorkerBankAccountSecure 에 이미 값이 있으면 덮어쓰지 않음
 *   - Worker.bankName 에만 값이 있는 경우에 한해 신규 구조로 복사
 *   - Worker.bankAccount 는 평문 원문 — 신규 구조로 복사하지 않음 (보안 원칙)
 *     → 실무자 재입력 필요 (계좌번호는 암호화 수집 경로만 허용)
 *   - dry-run 모드: 실제 쓰기 없이 이행 대상 건수만 출력
 *   - 재실행 시 이미 이행된 건 자동 스킵
 *
 * 실행:
 *   node scripts/migrate-bank-legacy.mjs          # dry-run (기본)
 *   node scripts/migrate-bank-legacy.mjs --apply  # 실제 이행
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = !process.argv.includes('--apply')

async function main() {
  console.log(`\n=== 레거시 계좌 이행 스크립트 ===`)
  console.log(`모드: ${DRY_RUN ? 'DRY-RUN (변경 없음)' : '🔴 실제 적용 (APPLY)'}`)
  console.log(`시작: ${new Date().toISOString()}\n`)

  // ─── 1. 현황 집계 ─────────────────────────────────────────────────────────

  const totalWorkers = await prisma.worker.count()

  // bankName 있는 레거시 건수
  const legacyBankNameCount = await prisma.worker.count({
    where: { bankName: { not: null } },
  })

  // bankAccount 있는 레거시 건수
  const legacyBankAccountCount = await prisma.worker.count({
    where: { bankAccount: { not: null } },
  })

  // 신규 구조 있는 건수
  const secureCount = await prisma.workerBankAccountSecure.count()

  // 레거시만 있고 신규 구조 없는 건수 (이행 대상)
  const migrationTargets = await prisma.worker.findMany({
    where: {
      bankName: { not: null },
      bankAccountSecure: null,  // 신규 구조 없음
    },
    select: { id: true, name: true, bankName: true },
  })

  // 둘 다 있는 중복 건수
  const bothExist = await prisma.worker.count({
    where: {
      bankName: { not: null },
      bankAccountSecure: { isNot: null },
    },
  })

  // 빈문자열/공백 건수
  const emptyBankName = await prisma.worker.count({
    where: {
      bankName: { in: ['', ' '] },
    },
  })

  console.log('─── DB 현황 집계 ─────────────────────────────────────────────')
  console.log(`전체 근로자:                ${totalWorkers}건`)
  console.log(`레거시 bankName 존재:       ${legacyBankNameCount}건`)
  console.log(`레거시 bankAccount 존재:    ${legacyBankAccountCount}건 (평문 — 이행 대상 아님)`)
  console.log(`신규 구조(secure) 존재:     ${secureCount}건`)
  console.log(`이행 대상 (레거시만 있음):  ${migrationTargets.length}건`)
  console.log(`중복 (레거시+신규 모두):    ${bothExist}건 (스킵)`)
  console.log(`빈문자열 bankName:          ${emptyBankName}건`)
  console.log('')

  if (migrationTargets.length === 0) {
    console.log('✅ 이행 대상 없음. 이미 완료 상태.')
    return
  }

  // ─── 2. 이행 대상 목록 출력 ────────────────────────────────────────────────

  console.log('─── 이행 대상 목록 ───────────────────────────────────────────')
  migrationTargets.forEach((w, i) => {
    const bankDisplay = w.bankName?.length && w.bankName.length > 0 ? w.bankName : '(빈값)'
    console.log(`  [${i + 1}] ${w.name} (id: ${w.id}) — bankName: "${bankDisplay}"`)
  })
  console.log('')

  // ─── 3. 이행 실행 ─────────────────────────────────────────────────────────

  if (DRY_RUN) {
    console.log(`DRY-RUN 완료 — 실제 변경 없음.`)
    console.log(`적용하려면: node scripts/migrate-bank-legacy.mjs --apply`)
    return
  }

  console.log('─── 이행 실행 ────────────────────────────────────────────────')
  let successCount = 0
  let failCount    = 0
  const exceptions = []

  for (const worker of migrationTargets) {
    try {
      // 빈문자열이나 공백만 있는 값은 이행 스킵
      const bankName = worker.bankName?.trim()
      if (!bankName) {
        exceptions.push({ workerId: worker.id, name: worker.name, reason: '빈문자열/공백 bankName — 스킵' })
        continue
      }

      await prisma.workerBankAccountSecure.upsert({
        where:  { workerId: worker.id },
        create: {
          workerId:   worker.id,
          bankName,
          collectedBy: 'MIGRATION_SCRIPT',
          collectedAt: new Date(),
        },
        update: {
          // 이미 있으면 bankName 만 채움 (accountNumber 등은 덮어쓰지 않음)
          bankName,
        },
      })

      console.log(`  ✅ 이행 완료: ${worker.name} — "${bankName}"`)
      successCount++
    } catch (err) {
      console.error(`  ❌ 이행 실패: ${worker.name} — ${err.message}`)
      exceptions.push({ workerId: worker.id, name: worker.name, reason: err.message })
      failCount++
    }
  }

  // ─── 4. 결과 요약 ──────────────────────────────────────────────────────────

  console.log('')
  console.log('─── 이행 결과 ────────────────────────────────────────────────')
  console.log(`성공: ${successCount}건`)
  console.log(`실패: ${failCount}건`)
  console.log(`예외(스킵): ${exceptions.length - failCount}건`)

  if (exceptions.length > 0) {
    console.log('\n─── 예외 목록 ────────────────────────────────────────────────')
    exceptions.forEach((e, i) => {
      console.log(`  [${i + 1}] ${e.name} (${e.workerId}) — ${e.reason}`)
    })
  }

  console.log('')
  console.log('⚠️  주의: Worker.bankAccount (계좌번호 평문) 는 보안 원칙상 이행하지 않습니다.')
  console.log('         계좌번호는 반드시 관리자가 /api/admin/workers/[id]/bank 경로로 재입력해야 합니다.')
  console.log('')
  console.log(`완료: ${new Date().toISOString()}`)
}

main()
  .catch(err => {
    console.error('스크립트 오류:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
