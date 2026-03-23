-- ─── MaterialMaster 필드 추가 ────────────────────────────────────────────────
ALTER TABLE "material_master"
  ADD COLUMN IF NOT EXISTS "discipline_code"            TEXT,
  ADD COLUMN IF NOT EXISTS "sub_discipline_code"        TEXT,
  ADD COLUMN IF NOT EXISTS "search_keywords"            TEXT,
  ADD COLUMN IF NOT EXISTS "is_requestable"             BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "g2b_source_id"              TEXT,
  ADD COLUMN IF NOT EXISTS "classification_updated_at"  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "material_master_discipline_code_idx" ON "material_master"("discipline_code");
CREATE INDEX IF NOT EXISTS "material_master_is_requestable_idx"  ON "material_master"("is_requestable");

-- ─── Enum 생성 ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "MaterialRequestStatus" AS ENUM (
    'DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MaterialRequestActorType" AS ENUM ('ADMIN','SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── material_requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "material_requests" (
  "id"                     TEXT          NOT NULL,
  "request_no"             TEXT          NOT NULL,
  "site_id"                TEXT,
  "requested_by"           TEXT          NOT NULL,
  "actor_type"             "MaterialRequestActorType" NOT NULL DEFAULT 'ADMIN',
  "status"                 "MaterialRequestStatus"    NOT NULL DEFAULT 'DRAFT',
  "title"                  TEXT          NOT NULL,
  "notes"                  TEXT,
  "delivery_requested_at"  TIMESTAMPTZ,
  "submitted_at"           TIMESTAMPTZ,
  "reviewed_at"            TIMESTAMPTZ,
  "reviewed_by"            TEXT,
  "approved_at"            TIMESTAMPTZ,
  "approved_by"            TEXT,
  "rejected_at"            TIMESTAMPTZ,
  "rejected_by"            TEXT,
  "reject_reason"          TEXT,
  "cancelled_at"           TIMESTAMPTZ,
  "cancelled_by"           TEXT,
  "created_at"             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "material_requests_request_no_key" ON "material_requests"("request_no");
CREATE INDEX IF NOT EXISTS "material_requests_site_id_idx"       ON "material_requests"("site_id");
CREATE INDEX IF NOT EXISTS "material_requests_status_idx"        ON "material_requests"("status");
CREATE INDEX IF NOT EXISTS "material_requests_requested_by_idx"  ON "material_requests"("requested_by");

ALTER TABLE "material_requests"
  DROP CONSTRAINT IF EXISTS "material_requests_site_id_fkey";
ALTER TABLE "material_requests"
  ADD CONSTRAINT "material_requests_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL;

-- ─── material_request_items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "material_request_items" (
  "id"                  TEXT          NOT NULL,
  "request_id"          TEXT          NOT NULL,
  "material_master_id"  TEXT,
  "item_code"           TEXT          NOT NULL,
  "item_name"           TEXT          NOT NULL,
  "spec"                TEXT,
  "unit"                TEXT,
  "discipline_code"     TEXT,
  "sub_discipline_code" TEXT,
  "requested_qty"       DECIMAL(15,4) NOT NULL,
  "approved_qty"        DECIMAL(15,4),
  "unit_price"          DECIMAL(15,2),
  "is_urgent"           BOOLEAN       NOT NULL DEFAULT FALSE,
  "allow_substitute"    BOOLEAN       NOT NULL DEFAULT FALSE,
  "notes"               TEXT,
  "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "material_request_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "material_request_items_request_id_idx"       ON "material_request_items"("request_id");
CREATE INDEX IF NOT EXISTS "material_request_items_material_master_id_idx" ON "material_request_items"("material_master_id");

ALTER TABLE "material_request_items"
  DROP CONSTRAINT IF EXISTS "material_request_items_request_id_fkey";
ALTER TABLE "material_request_items"
  ADD CONSTRAINT "material_request_items_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "material_requests"("id") ON DELETE CASCADE;

ALTER TABLE "material_request_items"
  DROP CONSTRAINT IF EXISTS "material_request_items_material_master_id_fkey";
ALTER TABLE "material_request_items"
  ADD CONSTRAINT "material_request_items_material_master_id_fkey"
  FOREIGN KEY ("material_master_id") REFERENCES "material_master"("id") ON DELETE SET NULL;

-- ─── material_request_status_history ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "material_request_status_history" (
  "id"          TEXT          NOT NULL,
  "request_id"  TEXT          NOT NULL,
  "from_status" "MaterialRequestStatus",
  "to_status"   "MaterialRequestStatus" NOT NULL,
  "actor_id"    TEXT,
  "actor_type"  "MaterialRequestActorType" NOT NULL DEFAULT 'ADMIN',
  "reason"      TEXT,
  "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "material_request_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "material_request_status_history_request_id_idx"
  ON "material_request_status_history"("request_id");

ALTER TABLE "material_request_status_history"
  DROP CONSTRAINT IF EXISTS "material_request_status_history_request_id_fkey";
ALTER TABLE "material_request_status_history"
  ADD CONSTRAINT "material_request_status_history_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "material_requests"("id") ON DELETE CASCADE;
