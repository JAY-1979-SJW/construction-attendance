/**
 * v3.4 Migration runner
 * worker_contracts 공사·직종·계약형태 필드 추가 + SafetyDocumentType 확장
 *
 * 서버 실행 방법:
 *   docker exec attendance node /app/scripts/run-migration-090000.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[v3.4 Migration] 시작...')

  // 1. worker_contracts 신규 컬럼 추가
  const columns = [
    ['projectName',    'TEXT'],
    ['workType',       'TEXT'],
    ['workTypeSub',    'TEXT'],
    ['jobCategory',    'TEXT'],
    ['jobCategorySub', 'TEXT'],
    ['contractForm',   'TEXT'],
    ['taskDescription','TEXT'],
  ]

  for (const [col, type] of columns) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "${col}" ${type}`
      )
      console.log(`  ✓ worker_contracts."${col}" 추가`)
    } catch (e) {
      console.error(`  ✗ worker_contracts."${col}":`, e.message)
    }
  }

  // 2. SafetyDocumentType enum 값 추가 (각각 별도 트랜잭션)
  for (const value of ['WORK_CONDITIONS_RECEIPT', 'PRIVACY_CONSENT']) {
    try {
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN ALTER TYPE "SafetyDocumentType" ADD VALUE IF NOT EXISTS '${value}'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`
      )
      console.log(`  ✓ SafetyDocumentType."${value}" 추가`)
    } catch (e) {
      console.error(`  ✗ SafetyDocumentType."${value}":`, e.message)
    }
  }

  // 3. migration_lock 기록
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'v34_contract_fields',
        NOW(),
        '20260323090000_add_contract_v34_fields',
        NULL, NULL, NOW(), 1
      )
      ON CONFLICT (migration_name) DO NOTHING
    `)
    console.log('  ✓ migration 기록 완료')
  } catch (e) {
    console.log('  ⚠ migration 기록 실패 (무시):', e.message)
  }

  console.log('[v3.4 Migration] 완료')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
