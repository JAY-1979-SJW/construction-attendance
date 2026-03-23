/**
 * v3.6 Migration runner
 * - SafetyDocumentType enum: BASIC_SAFETY_EDU_CONFIRM, SITE_SAFETY_RULES_CONFIRM 추가
 * - worker_contracts: companyName, companyPhone, workerBankName, workerAccountNumber, workerAccountHolder, workDate 추가
 *
 * 서버 실행:
 *   docker cp scripts/run-migration-092000.mjs attendance:/app/run-migration-092000.mjs
 *   docker exec attendance node /app/run-migration-092000.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function run(sql) {
  try {
    await prisma.$executeRawUnsafe(sql)
    return { ok: true }
  } catch (e) {
    return { ok: false, msg: e.message }
  }
}

async function main() {
  console.log('[v3.6 Migration] 시작...')

  // 1. SafetyDocumentType enum 추가
  for (const val of ['BASIC_SAFETY_EDU_CONFIRM', 'SITE_SAFETY_RULES_CONFIRM']) {
    const r = await run(`ALTER TYPE "SafetyDocumentType" ADD VALUE IF NOT EXISTS '${val}'`)
    console.log(r.ok ? `  ✓ SafetyDocumentType.${val}` : `  ✗ ${val}: ${r.msg}`)
  }

  // 2. worker_contracts 컬럼 추가
  const cols = [
    ['companyName',         'TEXT'],
    ['companyPhone',        'TEXT'],
    ['workerBankName',      'TEXT'],
    ['workerAccountNumber', 'TEXT'],
    ['workerAccountHolder', 'TEXT'],
    ['workDate',            'TEXT'],
  ]
  for (const [col, type] of cols) {
    const r = await run(`ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "${col}" ${type}`)
    console.log(r.ok ? `  ✓ worker_contracts.${col}` : `  ✗ ${col}: ${r.msg}`)
  }

  // 3. migration 기록
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'v36_daily_contract_final',
        NOW(),
        '20260323092000_add_daily_contract_v36_fields',
        NULL, NULL, NOW(), 1
      )
      ON CONFLICT (migration_name) DO NOTHING
    `)
    console.log('  ✓ migration 기록 완료')
  } catch (e) {
    console.log('  ⚠ migration 기록 실패 (무시):', e.message)
  }

  console.log('[v3.6 Migration] 완료')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
