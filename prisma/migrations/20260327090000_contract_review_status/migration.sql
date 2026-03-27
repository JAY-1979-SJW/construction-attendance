-- ContractStatus enum에 REVIEW_REQUESTED, REJECTED 추가
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUESTED';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- 기존 SIGNED 상태를 REVIEW_REQUESTED로 마이그레이션 (검토 대기 상태로 통합)
UPDATE "worker_contracts" SET "contractStatus" = 'REVIEW_REQUESTED' WHERE "contractStatus" = 'SIGNED';
