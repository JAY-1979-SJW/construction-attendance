/**
 * v3.8.1 Migration runner — EmploymentType enum 확장
 *
 * 추가값:
 *   - FIXED_TERM     : 기간제 근로자
 *   - CONTINUOUS_SITE: 계속근로형 현장근로자
 *
 * 기존 데이터(REGULAR, DAILY_CONSTRUCTION, BUSINESS_33, OTHER) 영향 없음.
 *
 * 서버 실행:
 *   docker cp scripts/run-migration-worker-types.mjs attendance:/app/run-migration-worker-types.mjs
 *   docker exec attendance node /app/run-migration-worker-types.mjs
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
  console.log('[v3.8.1 Migration] EmploymentType enum 확장 시작...')

  const r1 = await run(`ALTER TYPE "EmploymentType" ADD VALUE IF NOT EXISTS 'FIXED_TERM'`)
  console.log(r1.ok ? "  ✓ FIXED_TERM 추가" : `  ✗ FIXED_TERM: ${r1.msg}`)

  const r2 = await run(`ALTER TYPE "EmploymentType" ADD VALUE IF NOT EXISTS 'CONTINUOUS_SITE'`)
  console.log(r2.ok ? "  ✓ CONTINUOUS_SITE 추가" : `  ✗ CONTINUOUS_SITE: ${r2.msg}`)

  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'v381_employment_type_fixed_term_continuous',
        NOW(),
        '20260323093000_add_employment_type_values',
        NULL, NULL, NOW(), 1
      )
      ON CONFLICT DO NOTHING
    `)
    console.log('  ✓ Prisma migration 기록 완료')
  } catch (e) {
    console.log('  ⚠ migration 기록 실패 (무시 가능):', e.message)
  }

  console.log('[v3.8.1 Migration] 완료')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
