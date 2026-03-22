-- Phase 7: 푸시 알림 인프라 + 체류확인 푸시 추적

-- WorkerDevice: FCM 푸시 토큰 추가
ALTER TABLE "worker_devices" ADD COLUMN "fcmToken" TEXT;

-- PresenceCheck: 푸시 발송 추적 필드 추가
ALTER TABLE "presence_checks" ADD COLUMN "pushSentAt" TIMESTAMP(3);
ALTER TABLE "presence_checks" ADD COLUMN "pushFailedAt" TIMESTAMP(3);
