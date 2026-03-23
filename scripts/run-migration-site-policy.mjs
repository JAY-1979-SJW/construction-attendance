/**
 * v3.8 Migration runner — 현장별 근무시간·휴게시간 정책 테이블 생성
 *
 * 신규 테이블: site_attendance_policies
 *   - 현장별 breakMinutes 설정 (공수 계산 직접 적용)
 *   - workStartTime/workEndTime/breakStartTime/breakEndTime (표시용)
 *   - null 필드 = 회사 기본값(60분) 자동 사용
 *
 * 서버 실행:
 *   docker cp scripts/run-migration-site-policy.mjs attendance:/app/run-migration-site-policy.mjs
 *   docker exec attendance node /app/run-migration-site-policy.mjs
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
  console.log('[v3.8 Migration] site_attendance_policies 테이블 생성 시작...')

  const r1 = await run(`
    CREATE TABLE IF NOT EXISTS "site_attendance_policies" (
      "id" TEXT NOT NULL,
      "siteId" TEXT NOT NULL,
      "workStartTime" TEXT,
      "workEndTime" TEXT,
      "breakStartTime" TEXT,
      "breakEndTime" TEXT,
      "breakMinutes" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "site_attendance_policies_pkey" PRIMARY KEY ("id")
    )
  `)
  console.log(r1.ok ? '  ✓ 테이블 생성' : `  ✗ 테이블 생성 실패: ${r1.msg}`)

  const r2 = await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS "site_attendance_policies_siteId_key"
    ON "site_attendance_policies"("siteId")
  `)
  console.log(r2.ok ? '  ✓ siteId 유니크 인덱스 생성' : `  ✗ 인덱스 생성 실패: ${r2.msg}`)

  const r3 = await run(`
    ALTER TABLE "site_attendance_policies"
    ADD CONSTRAINT IF NOT EXISTS "site_attendance_policies_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
  `)
  console.log(r3.ok ? '  ✓ 외래키 제약 추가' : `  ✗ 외래키 실패: ${r3.msg}`)

  // Prisma migration 기록 등록
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'v38_site_attendance_policy',
        NOW(),
        '20260323092100_add_site_attendance_policy',
        NULL, NULL, NOW(), 1
      )
      ON CONFLICT DO NOTHING
    `)
    console.log('  ✓ Prisma migration 기록 완료')
  } catch (e) {
    console.log('  ⚠ migration 기록 실패 (무시 가능):', e.message)
  }

  console.log('[v3.8 Migration] 완료')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
