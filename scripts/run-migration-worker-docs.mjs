/**
 * run-migration-worker-docs.mjs
 * workers 테이블에 서류/교육 직접 입력 컬럼 추가
 *
 * 실행: node /app/run-migration-worker-docs.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[Migration] 근로자 서류/교육 직접 입력 컬럼 추가 시작...')

  const cols = [
    ['contract_written_yn',         'BOOLEAN NOT NULL DEFAULT FALSE'],
    ['contract_written_date',       'TEXT'],
    ['contract_issued_yn',          'BOOLEAN NOT NULL DEFAULT FALSE'],
    ['contract_attached_yn',        'BOOLEAN NOT NULL DEFAULT FALSE'],
    ['safety_edu_completed_yn',     'BOOLEAN NOT NULL DEFAULT FALSE'],
    ['safety_edu_type',             'TEXT'],
    ['safety_edu_date',             'TEXT'],
    ['safety_edu_cert_attached_yn', 'BOOLEAN NOT NULL DEFAULT FALSE'],
  ]

  for (const [col, def] of cols) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE workers ADD COLUMN IF NOT EXISTS ${col} ${def}`
      )
      console.log(`  [OK] workers.${col}`)
    } catch (e) {
      console.error(`  [ERR] workers.${col}:`, e.message)
    }
  }

  console.log('\n[Migration] DONE')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
