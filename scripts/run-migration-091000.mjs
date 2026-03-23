/**
 * v3.5 Migration runner
 * - ContractTemplateType enum: MONTHLY_FIXED_EMPLOYMENT, CONTINUOUS_EMPLOYMENT 추가
 * - contract_versions: signedBy, signedAt, deliveredBy, deliveredAt, deliveryMethod, templateType, changeReason, status 추가
 *
 * 서버 실행:
 *   docker cp scripts/run-migration-091000.mjs attendance:/app/
 *   docker exec attendance node /app/run-migration-091000.mjs
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
  console.log('[v3.5 Migration] 시작...')

  // 1. ContractTemplateType enum 추가
  for (const val of ['MONTHLY_FIXED_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT']) {
    const r = await run(`ALTER TYPE "ContractTemplateType" ADD VALUE IF NOT EXISTS '${val}'`)
    console.log(r.ok ? `  ✓ ContractTemplateType.${val}` : `  ✗ ${val}: ${r.msg}`)
  }

  // 2. contract_versions 컬럼 추가
  const cols = [
    ['signedBy',       'TEXT'],
    ['signedAt',       'TIMESTAMPTZ'],
    ['deliveredBy',    'TEXT'],
    ['deliveredAt',    'TIMESTAMPTZ'],
    ['deliveryMethod', 'TEXT'],
    ['templateType',   'TEXT'],
    ['changeReason',   'TEXT'],
    ['status',         'TEXT DEFAULT \'DRAFT\''],
  ]
  for (const [col, type] of cols) {
    const r = await run(`ALTER TABLE "contract_versions" ADD COLUMN IF NOT EXISTS "${col}" ${type}`)
    console.log(r.ok ? `  ✓ contract_versions.${col}` : `  ✗ ${col}: ${r.msg}`)
  }

  // 3. worker_contracts — siteAddress 컬럼 추가 (현장주소 직접 입력용)
  const r = await run(`ALTER TABLE "worker_contracts" ADD COLUMN IF NOT EXISTS "siteAddress" TEXT`)
  console.log(r.ok ? '  ✓ worker_contracts.siteAddress' : `  ✗ siteAddress: ${r.msg}`)

  console.log('[v3.5 Migration] 완료')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
