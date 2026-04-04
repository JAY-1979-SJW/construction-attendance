-- Migration: add HQ_ADMIN to AdminRole enum
-- HQ_ADMIN = 본사관리자 (전체 현장 조회 + 승인, 계좌 복호화 제외)
-- ADMIN(레거시)과 동등하나 신규 계정은 HQ_ADMIN 사용 권장

ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'HQ_ADMIN';
