-- materials 테이블
CREATE TABLE "materials" (
    "id"           SERIAL          NOT NULL,
    "code"         TEXT            NOT NULL,
    "name"         TEXT            NOT NULL,
    "spec"         TEXT,
    "unit"         TEXT            NOT NULL,
    "category"     TEXT            NOT NULL,
    "sub_category" TEXT,
    "base_price"   DECIMAL(12,2),
    "source"       TEXT            NOT NULL,
    "base_date"    DATE            NOT NULL,
    "updated_at"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- UNIQUE(code, source) — 출처별 자재코드 중복 방지
CREATE UNIQUE INDEX "materials_code_source_key" ON "materials"("code", "source");
CREATE INDEX "materials_category_idx" ON "materials"("category");
CREATE INDEX "materials_name_idx"     ON "materials"("name");

-- material_sync_log 테이블
CREATE TABLE "material_sync_log" (
    "id"          SERIAL          NOT NULL,
    "source"      TEXT            NOT NULL,
    "synced_at"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_count" INTEGER         NOT NULL,
    "inserted"    INTEGER         NOT NULL DEFAULT 0,
    "updated"     INTEGER         NOT NULL DEFAULT 0,
    "failed"      INTEGER         NOT NULL DEFAULT 0,
    "note"        TEXT,
    CONSTRAINT "material_sync_log_pkey" PRIMARY KEY ("id")
);
