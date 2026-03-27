-- ContractStatus enum에 REVIEW_REQUESTED, REJECTED 추가
-- 주의: ALTER TYPE ADD VALUE는 트랜잭션 내에서 실행 불가하므로 수동 적용됨
-- 아래 구문은 IF NOT EXISTS로 멱등성 보장 (이미 존재하면 무시)
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUESTED';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
