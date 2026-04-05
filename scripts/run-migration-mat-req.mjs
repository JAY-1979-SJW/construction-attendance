/**
 * 자재청구 확장 마이그레이션
 * - MaterialRequestStatus enum에 ORDERED, RECEIVED 추가
 * - material_request_items에 use_location 컬럼 추가
 * - material_requests에 requested_by_name 컬럼 추가
 *
 * 서버 실행:
 *   docker cp scripts/run-migration-mat-req.mjs attendance:/app/run-migration-mat-req.mjs
 *   docker exec attendance node /app/run-migration-mat-req.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function run(label, sql) {
  try {
    await prisma.$executeRawUnsafe(sql)
    console.log(`  [OK] ${label}`)
    return true
  } catch (e) {
    if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
      console.log(`  [SKIP] ${label} — already exists`)
      return true
    }
    console.error(`  [FAIL] ${label}: ${e.message}`)
    return false
  }
}

async function main() {
  console.log('[Migration] 자재청구 확장 시작...')

  const results = await Promise.all([
    run('ORDERED enum 추가',
      `ALTER TYPE "MaterialRequestStatus" ADD VALUE IF NOT EXISTS 'ORDERED'`),
    run('RECEIVED enum 추가',
      `ALTER TYPE "MaterialRequestStatus" ADD VALUE IF NOT EXISTS 'RECEIVED'`),
  ])

  // enum 변경 후 컬럼 추가 (순차 실행)
  await run('material_request_items.use_location 추가',
    `ALTER TABLE "material_request_items" ADD COLUMN IF NOT EXISTS "use_location" TEXT`)
  await run('material_requests.requested_by_name 추가',
    `ALTER TABLE "material_requests" ADD COLUMN IF NOT EXISTS "requested_by_name" TEXT`)

  const ok = results.every(Boolean)
  console.log(`\n[Migration] ${ok ? 'DONE' : 'PARTIAL FAIL'}`)
}

main().catch(e => {
  console.error('[Migration] 오류:', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
