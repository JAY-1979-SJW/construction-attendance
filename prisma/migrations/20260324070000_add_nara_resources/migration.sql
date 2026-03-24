-- CreateTable: 나라장터 자원분류 마스터
CREATE TABLE "nara_resources" (
    "id"               SERIAL         NOT NULL,
    "rsce_ty_extrnl_cd" TEXT,
    "lvl_rsce_clsfc_nm1" TEXT,
    "lvl_rsce_clsfc_nm2" TEXT,
    "net_rsce_cd"       TEXT,
    "rsce_nm"           TEXT,
    "rsce_spec_nm"      TEXT,
    "unit"              TEXT,
    "lbrcst"            DECIMAL(65,30),
    "collected_at"      TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nara_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nara_resources_rsce_ty_extrnl_cd_idx" ON "nara_resources"("rsce_ty_extrnl_cd");
CREATE INDEX "nara_resources_lvl_rsce_clsfc_nm1_idx" ON "nara_resources"("lvl_rsce_clsfc_nm1");
CREATE INDEX "nara_resources_rsce_nm_idx"             ON "nara_resources"("rsce_nm");
