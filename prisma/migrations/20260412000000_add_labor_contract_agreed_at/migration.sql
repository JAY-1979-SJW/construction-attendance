-- Add labor_contract_agreed_at to Worker
-- 근로자가 모바일 앱에서 근로계약서 팝업에 동의한 시각
ALTER TABLE "workers" ADD COLUMN "labor_contract_agreed_at" TIMESTAMP(3);
