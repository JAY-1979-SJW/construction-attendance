/**
 * 미퇴근 자동 종료 실행 스크립트
 *
 * 사용법:
 *   npx tsx scripts/run-auto-checkout.ts          # 실제 실행
 *   npx tsx scripts/run-auto-checkout.ts --dry-run # 대상만 출력 (DB 변경 없음)
 *
 * 크론 등록 예시 (매일 04:00 KST = 19:00 UTC):
 *   0 19 * * * cd /path/to/app && npx tsx scripts/run-auto-checkout.ts >> logs/auto-checkout.log 2>&1
 *
 * Windows 작업 스케줄러:
 *   트리거: 매일 04:00 (KST)
 *   동작: npx tsx scripts/run-auto-checkout.ts
 *   시작 위치: C:\Users\skyjw\construction-attendance
 */

/**
 * 실행 전 환경변수 설정 필요:
 *   - Windows: 시스템 환경변수 또는 .env 파일
 *   - Linux:   export DATABASE_URL=... && npx tsx scripts/run-auto-checkout.ts
 *
 * Next.js 앱과 동일한 .env 파일을 사용하려면:
 *   npx dotenv -e .env -- npx tsx scripts/run-auto-checkout.ts
 *   (dotenv-cli 설치: npm i -g dotenv-cli)
 */

// tsconfig-paths를 통해 @/ alias 지원 (devDependency로 설치 필요 시: npm i -D tsconfig-paths)
import { runAutoCheckout } from '../lib/jobs/autoCheckout'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const startTime = Date.now()
  console.log(`[auto-checkout] 시작: ${new Date().toISOString()} | dryRun=${dryRun}`)

  try {
    const result = await runAutoCheckout(dryRun)

    const elapsed = Date.now() - startTime

    console.log('[auto-checkout] 완료')
    console.log(`  실행시각  : ${result.runAt}`)
    console.log(`  기준날짜  : ${result.targetDate}`)
    console.log(`  대상 건수 : ${result.totalFound}`)
    console.log(`  처리 성공 : ${result.processed}`)
    console.log(`  스킵(중복): ${result.skipped}`)
    console.log(`  처리 실패 : ${result.failed}`)
    console.log(`  소요시간  : ${elapsed}ms`)

    if (result.errors.length > 0) {
      console.warn('[auto-checkout] 실패 목록:')
      result.errors.forEach((e) => {
        console.warn(`  ID=${e.id} | 사유=${e.reason}`)
      })
    }

    if (dryRun) {
      console.log('[auto-checkout] dry-run 모드 — DB 변경 없음')
    }

    process.exit(result.failed > 0 ? 1 : 0)
  } catch (err) {
    console.error('[auto-checkout] 치명적 오류:', err)
    process.exit(2)
  }
}

main()
