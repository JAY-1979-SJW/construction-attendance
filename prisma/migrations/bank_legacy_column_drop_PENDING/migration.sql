-- ============================================================
-- 레거시 계좌 컬럼 삭제 Migration — PENDING (실행 조건 충족 후 적용)
-- ============================================================
--
-- 삭제 대상:
--   workers.bank_name     (Worker.bankName — 평문 은행명)
--   workers.bank_account  (Worker.bankAccount — 평문 계좌번호)
--
-- 실행 조건 (아래 모두 확인 후 적용):
--   1. scripts/migrate-bank-legacy.mjs --apply 실행 완료
--   2. 이행 성공 건수 확인 (실패·예외 0건 권장)
--   3. GET /api/admin/workers, /api/admin/workers/[id] 에서 bankName/bankAccount 응답 0건 확인
--   4. 계약 자동채움, 문서 출력에서 레거시 컬럼 참조 0건 확인
--   5. 서비스 배포 후 1주일 이상 모니터링
--   6. DB 백업 완료 후 실행
--
-- 적용 방법:
--   이 파일을 정식 migration 번호로 복사 후 prisma migrate resolve 또는 직접 실행
--   예: psql -d <db> -f migration.sql
--
-- 롤백 방법:
--   ALTER TABLE workers ADD COLUMN bank_name TEXT;
--   ALTER TABLE workers ADD COLUMN bank_account TEXT;
--   (데이터 복원은 scripts/migrate-bank-legacy.mjs 역방향 스크립트 작성 필요)
-- ============================================================

-- 실행 전 잔존 건수 확인 (0건이어야 정상)
-- SELECT COUNT(*) FROM workers WHERE bank_name IS NOT NULL;
-- SELECT COUNT(*) FROM workers WHERE bank_account IS NOT NULL;

ALTER TABLE workers DROP COLUMN IF EXISTS bank_name;
ALTER TABLE workers DROP COLUMN IF EXISTS bank_account;
