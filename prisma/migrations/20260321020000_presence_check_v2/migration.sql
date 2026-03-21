-- Add new enum values to PresenceCheckStatus
ALTER TYPE "PresenceCheckStatus" ADD VALUE IF NOT EXISTS 'NO_RESPONSE';
ALTER TYPE "PresenceCheckStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUIRED';
ALTER TYPE "PresenceCheckStatus" ADD VALUE IF NOT EXISTS 'CANCELED';
ALTER TYPE "PresenceCheckStatus" ADD VALUE IF NOT EXISTS 'MANUALLY_CONFIRMED';
ALTER TYPE "PresenceCheckStatus" ADD VALUE IF NOT EXISTS 'MANUALLY_REJECTED';

-- Add columns to presence_checks
ALTER TABLE "presence_checks"
  ADD COLUMN IF NOT EXISTS "reviewed_by"      TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_at"      TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "admin_note"       TEXT,
  ADD COLUMN IF NOT EXISTS "reissued_from_id" TEXT,
  ADD COLUMN IF NOT EXISTS "reissue_count"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "closed_at"        TIMESTAMP WITH TIME ZONE;

-- Create audit log table
CREATE TABLE IF NOT EXISTS "presence_check_audit_logs" (
  "id"                  TEXT NOT NULL,
  "presence_check_id"   TEXT NOT NULL,
  "action"              TEXT NOT NULL,
  "actor_type"          TEXT NOT NULL,
  "actor_id"            TEXT,
  "actor_name_snapshot" TEXT,
  "from_status"         TEXT,
  "to_status"           TEXT,
  "message"             TEXT,
  "metadata_json"       JSONB,
  "created_at"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "presence_check_audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "presence_check_audit_logs_presence_check_id_fkey"
    FOREIGN KEY ("presence_check_id") REFERENCES "presence_checks"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "presence_check_audit_logs_presence_check_id_idx"
  ON "presence_check_audit_logs"("presence_check_id");
CREATE INDEX IF NOT EXISTS "presence_check_audit_logs_created_at_idx"
  ON "presence_check_audit_logs"("created_at");
