/**
 * v3.6.1 Migration runner
 * - GeneratedDocumentType enum에 일용직 4종 추가
 *   WORK_CONDITIONS_RECEIPT, PRIVACY_CONSENT,
 *   BASIC_SAFETY_EDU_CONFIRM, SITE_SAFETY_RULES_CONFIRM
 *
 * 서버 실행:
 *   docker cp scripts/run-migration-092100.mjs attendance:/app/run-migration-092100.mjs
 *   docker exec attendance node /app/run-migration-092100.mjs
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
  console.log('[v3.6.1 Migration] 시작...')

  for (const val of [
    'WORK_CONDITIONS_RECEIPT',
    'PRIVACY_CONSENT',
    'BASIC_SAFETY_EDU_CONFIRM',
    'SITE_SAFETY_RULES_CONFIRM',
  ]) {
    const r = await run(`ALTER TYPE "GeneratedDocumentType" ADD VALUE IF NOT EXISTS '${val}'`)
    console.log(r.ok ? `  ✓ GeneratedDocumentType.${val}` : `  ✗ ${val}: ${r.msg}`)
  }

  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'v361_generated_doc_type_daily',
        NOW(),
        '20260323092100_add_daily_doc_types_to_generated_document_type',
        NULL, NULL, NOW(), 1
      )
      ON CONFLICT DO NOTHING
    `)
    console.log('  ✓ migration 기록 완료')
  } catch (e) {
    console.log('  ⚠ migration 기록 실패 (무시):', e.message)
  }

  console.log('[v3.6.1 Migration] 완료')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
