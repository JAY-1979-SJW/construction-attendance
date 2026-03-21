-- Fix: presence_check_v2 migration created columns with snake_case,
--      but rest of the schema uses camelCase. Rename to match.

-- presence_checks: new columns from v2
ALTER TABLE "presence_checks" RENAME COLUMN "reviewed_by"      TO "reviewedBy";
ALTER TABLE "presence_checks" RENAME COLUMN "reviewed_at"      TO "reviewedAt";
ALTER TABLE "presence_checks" RENAME COLUMN "admin_note"       TO "adminNote";
ALTER TABLE "presence_checks" RENAME COLUMN "reissued_from_id" TO "reissuedFromId";
ALTER TABLE "presence_checks" RENAME COLUMN "reissue_count"    TO "reissueCount";
ALTER TABLE "presence_checks" RENAME COLUMN "closed_at"        TO "closedAt";

-- presence_check_audit_logs: all columns need camelCase
ALTER TABLE "presence_check_audit_logs" RENAME COLUMN "presence_check_id"   TO "presenceCheckId";
ALTER TABLE "presence_check_audit_logs" RENAME COLUMN "actor_type"          TO "actorType";
ALTER TABLE "presence_check_audit_logs" RENAME COLUMN "actor_id"            TO "actorId";
ALTER TABLE "presence_check_audit_logs" RENAME COLUMN "actor_name_snapshot" TO "actorNameSnapshot";
ALTER TABLE "presence_check_audit_logs" RENAME COLUMN "from_status"         TO "fromStatus";
ALTER TABLE "presence_check_audit_logs" RENAME COLUMN "to_status"           TO "toStatus";
ALTER TABLE "presence_check_audit_logs" RENAME COLUMN "metadata_json"       TO "metadataJson";
ALTER TABLE "presence_check_audit_logs" RENAME COLUMN "created_at"          TO "createdAt";
