-- CreateEnum
CREATE TYPE "WorkerReportStatus" AS ENUM ('WRITTEN', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "ReportEmploymentType" AS ENUM ('DIRECT', 'DAILY', 'OUTSOURCE_LEAD', 'OUTSOURCE_CREW');

-- CreateTable: 근로자 작업일보
CREATE TABLE "worker_daily_reports" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "attendanceLogId" TEXT,
    "reportDate" DATE NOT NULL,
    "employmentType" "ReportEmploymentType" NOT NULL DEFAULT 'DIRECT',
    "jobTitle" TEXT NOT NULL DEFAULT '미설정',
    -- 공종/작업사항
    "tradeFamilyCode" TEXT,
    "tradeFamilyLabel" TEXT,
    "tradeCode" TEXT,
    "tradeLabel" TEXT,
    "taskCode" TEXT,
    "taskLabel" TEXT,
    "workDetail" TEXT,
    -- 작업 위치
    "buildingName" TEXT,
    "floorLabel" TEXT,
    "locationDetail" TEXT,
    "locationDisplayName" TEXT,
    -- 작업 3구조
    "yesterdayWork" TEXT,
    "todayWork" TEXT,
    "tomorrowWork" TEXT,
    -- 레거시 분류
    "workType" TEXT,
    "processType" TEXT,
    -- 작업시간
    "workStartTime" TEXT,
    "workEndTime" TEXT,
    -- 반복·공수
    "consecutiveDays" INTEGER NOT NULL DEFAULT 1,
    "todayManDays" DECIMAL(4,1) NOT NULL DEFAULT 1.0,
    "monthlyManDays" DECIMAL(6,1) NOT NULL DEFAULT 0,
    "totalManDays" DECIMAL(8,1) NOT NULL DEFAULT 0,
    -- 부가
    "notes" TEXT,
    "materialUsedYn" BOOLEAN NOT NULL DEFAULT false,
    "materialNote" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "copiedFromPreviousYn" BOOLEAN NOT NULL DEFAULT false,
    "copiedToTomorrowYn" BOOLEAN NOT NULL DEFAULT false,
    -- 관리자 확인
    "status" "WorkerReportStatus" NOT NULL DEFAULT 'WRITTEN',
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "adminMemo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_daily_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "worker_daily_reports_siteId_reportDate_idx" ON "worker_daily_reports"("siteId", "reportDate");
CREATE INDEX "worker_daily_reports_workerId_reportDate_idx" ON "worker_daily_reports"("workerId", "reportDate");
CREATE INDEX "worker_daily_reports_status_idx" ON "worker_daily_reports"("status");
CREATE INDEX "worker_daily_reports_trade_idx" ON "worker_daily_reports"("tradeFamilyCode", "tradeCode", "taskCode");
CREATE UNIQUE INDEX "worker_daily_reports_workerId_siteId_reportDate_key" ON "worker_daily_reports"("workerId", "siteId", "reportDate");

ALTER TABLE "worker_daily_reports" ADD CONSTRAINT "worker_daily_reports_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_daily_reports" ADD CONSTRAINT "worker_daily_reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: 현장별 위치 마스터
CREATE TABLE "site_location_masters" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "floorOrder" INTEGER NOT NULL DEFAULT 0,
    "floorLabel" TEXT NOT NULL,
    "detailLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_location_masters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_location_masters_siteId_buildingName_idx" ON "site_location_masters"("siteId", "buildingName");
CREATE INDEX "site_location_masters_siteId_isActive_idx" ON "site_location_masters"("siteId", "isActive");

ALTER TABLE "site_location_masters" ADD CONSTRAINT "site_location_masters_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: 공종 계열 마스터
CREATE TABLE "trade_family_masters" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_family_masters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trade_family_masters_code_key" ON "trade_family_masters"("code");

-- CreateTable: 세부 공종 마스터
CREATE TABLE "trade_masters" (
    "id" TEXT NOT NULL,
    "tradeFamilyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_masters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trade_masters_code_key" ON "trade_masters"("code");
CREATE INDEX "trade_masters_tradeFamilyId_idx" ON "trade_masters"("tradeFamilyId");

ALTER TABLE "trade_masters" ADD CONSTRAINT "trade_masters_tradeFamilyId_fkey" FOREIGN KEY ("tradeFamilyId") REFERENCES "trade_family_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: 작업사항 마스터 (계열 기준)
CREATE TABLE "task_masters" (
    "id" TEXT NOT NULL,
    "tradeFamilyId" TEXT NOT NULL,
    "tradeId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_masters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_masters_code_key" ON "task_masters"("code");
CREATE INDEX "task_masters_tradeFamilyId_idx" ON "task_masters"("tradeFamilyId");
CREATE INDEX "task_masters_tradeId_idx" ON "task_masters"("tradeId");

ALTER TABLE "task_masters" ADD CONSTRAINT "task_masters_tradeFamilyId_fkey" FOREIGN KEY ("tradeFamilyId") REFERENCES "trade_family_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: 공종 계열 + 세부 공종 + 작업사항 기본 데이터
INSERT INTO "trade_family_masters" ("id","code","label","sortOrder","isActive","createdAt","updatedAt") VALUES
  ('tf_elec','ELEC','전기계열',1,true,NOW(),NOW()),
  ('tf_mech','MECH','기계계열',2,true,NOW(),NOW()),
  ('tf_civil','CIVIL','토목/건축계열',3,true,NOW(),NOW()),
  ('tf_etc','ETC','기타',99,true,NOW(),NOW());

INSERT INTO "trade_masters" ("id","tradeFamilyId","code","label","sortOrder","isActive","createdAt","updatedAt") VALUES
  ('tr_elec','tf_elec','ELECTRICAL','전기',1,true,NOW(),NOW()),
  ('tr_fire_elec','tf_elec','FIRE_ELEC','소방전기',2,true,NOW(),NOW()),
  ('tr_telecom','tf_elec','TELECOM','통신',3,true,NOW(),NOW()),
  ('tr_fire_mech','tf_mech','FIRE_MECH','소방기계',1,true,NOW(),NOW()),
  ('tr_plumbing','tf_mech','PLUMBING','설비/배관',2,true,NOW(),NOW()),
  ('tr_duct','tf_mech','DUCT','덕트',3,true,NOW(),NOW()),
  ('tr_civil','tf_civil','CIVIL','토목',1,true,NOW(),NOW()),
  ('tr_arch','tf_civil','ARCHITECTURE','건축',2,true,NOW(),NOW()),
  ('tr_etc','tf_etc','ETC_GENERAL','기타',1,true,NOW(),NOW());

-- 전기계열 공통 작업사항
INSERT INTO "task_masters" ("id","tradeFamilyId","tradeId","code","label","sortOrder","isActive","createdAt","updatedAt") VALUES
  ('tk_wiring','tf_elec',NULL,'WIRING','입선',1,true,NOW(),NOW()),
  ('tk_slab_conduit','tf_elec',NULL,'SLAB_CONDUIT','슬라브 배관',2,true,NOW(),NOW()),
  ('tk_wall_conduit','tf_elec',NULL,'WALL_CONDUIT','벽체 배관',3,true,NOW(),NOW()),
  ('tk_box_mount','tf_elec',NULL,'BOX_MOUNT','박스 취부',4,true,NOW(),NOW()),
  ('tk_cable_lay','tf_elec',NULL,'CABLE_LAY','케이블 포설',5,true,NOW(),NOW()),
  ('tk_conduit_install','tf_elec',NULL,'CONDUIT_INSTALL','전선관 설치',6,true,NOW(),NOW()),
  ('tk_tray_install','tf_elec',NULL,'TRAY_INSTALL','트레이 설치',7,true,NOW(),NOW()),
  ('tk_grounding','tf_elec',NULL,'GROUNDING','접지 작업',8,true,NOW(),NOW()),
  ('tk_panel_install','tf_elec',NULL,'PANEL_INSTALL','분전반 설치',9,true,NOW(),NOW()),
  ('tk_termination','tf_elec',NULL,'TERMINATION','결선',10,true,NOW(),NOW()),
  ('tk_commissioning_prep','tf_elec',NULL,'COMMISSIONING_PREP','시운전 준비',11,true,NOW(),NOW()),
  -- 소방전기 전용
  ('tk_detector_wire','tf_elec','tr_fire_elec','DETECTOR_WIRING','감지기 배선',20,true,NOW(),NOW()),
  ('tk_transmitter_wire','tf_elec','tr_fire_elec','TRANSMITTER_WIRING','발신기 배선',21,true,NOW(),NOW()),
  ('tk_receiver_term','tf_elec','tr_fire_elec','RECEIVER_TERMINATION','수신기 결선',22,true,NOW(),NOW()),
  ('tk_exit_light_wire','tf_elec','tr_fire_elec','EXIT_LIGHT_WIRING','유도등 배선',23,true,NOW(),NOW()),
  ('tk_detector_mount','tf_elec','tr_fire_elec','DETECTOR_MOUNT','감지기 취부',24,true,NOW(),NOW()),
  ('tk_transmitter_mount','tf_elec','tr_fire_elec','TRANSMITTER_MOUNT','발신기 취부',25,true,NOW(),NOW()),
  ('tk_exit_light_mount','tf_elec','tr_fire_elec','EXIT_LIGHT_MOUNT','유도등 취부',26,true,NOW(),NOW()),
  ('tk_inspection','tf_elec','tr_fire_elec','FIRE_ELEC_INSPECTION','점검',27,true,NOW(),NOW());

-- 기계계열 공통 작업사항
INSERT INTO "task_masters" ("id","tradeFamilyId","tradeId","code","label","sortOrder","isActive","createdAt","updatedAt") VALUES
  ('tk_sleeve','tf_mech',NULL,'SLEEVE_WORK','슬리브 작업',1,true,NOW(),NOW()),
  ('tk_pipe_install','tf_mech',NULL,'PIPE_INSTALL','배관 설치',2,true,NOW(),NOW()),
  ('tk_branch_pipe','tf_mech',NULL,'BRANCH_PIPE','가지배관',3,true,NOW(),NOW()),
  ('tk_main_pipe','tf_mech',NULL,'MAIN_PIPE','주배관 설치',4,true,NOW(),NOW()),
  ('tk_head_mount','tf_mech',NULL,'HEAD_MOUNT','헤드 취부',5,true,NOW(),NOW()),
  ('tk_hydrant_pipe','tf_mech',NULL,'HYDRANT_PIPE','소화전 배관',6,true,NOW(),NOW()),
  ('tk_valve_install','tf_mech',NULL,'VALVE_INSTALL','밸브 설치',7,true,NOW(),NOW()),
  ('tk_pump_pipe','tf_mech',NULL,'PUMP_ROOM_PIPE','펌프실 배관',8,true,NOW(),NOW()),
  ('tk_pressure_test','tf_mech',NULL,'PRESSURE_TEST','압력시험 준비',9,true,NOW(),NOW()),
  ('tk_mech_commission','tf_mech',NULL,'MECH_COMMISSIONING','시운전 준비',10,true,NOW(),NOW()),
  ('tk_support_install','tf_mech',NULL,'SUPPORT_INSTALL','지지대 설치',11,true,NOW(),NOW()),
  ('tk_insulation','tf_mech',NULL,'INSULATION','보온 작업',12,true,NOW(),NOW()),
  ('tk_equip_connect','tf_mech',NULL,'EQUIPMENT_CONNECT','장비 연결',13,true,NOW(),NOW()),
  ('tk_mech_repair','tf_mech',NULL,'MECH_REPAIR','보수',14,true,NOW(),NOW());

-- 토목/건축계열 작업사항
INSERT INTO "task_masters" ("id","tradeFamilyId","tradeId","code","label","sortOrder","isActive","createdAt","updatedAt") VALUES
  ('tk_excavation','tf_civil',NULL,'EXCAVATION','굴착',1,true,NOW(),NOW()),
  ('tk_formwork','tf_civil',NULL,'FORMWORK','거푸집',2,true,NOW(),NOW()),
  ('tk_rebar','tf_civil',NULL,'REBAR','철근',3,true,NOW(),NOW()),
  ('tk_concrete','tf_civil',NULL,'CONCRETE','콘크리트',4,true,NOW(),NOW()),
  ('tk_waterproof','tf_civil',NULL,'WATERPROOF','방수',5,true,NOW(),NOW()),
  ('tk_masonry','tf_civil',NULL,'MASONRY','조적',6,true,NOW(),NOW()),
  ('tk_finishing','tf_civil',NULL,'FINISHING','마감',7,true,NOW(),NOW()),
  ('tk_demolition','tf_civil',NULL,'DEMOLITION','철거',8,true,NOW(),NOW()),
  ('tk_material_in','tf_civil',NULL,'MATERIAL_RECEIPT','자재 반입',9,true,NOW(),NOW()),
  ('tk_cleanup','tf_civil',NULL,'CLEANUP','정리/청소',10,true,NOW(),NOW());

-- 기타 작업사항
INSERT INTO "task_masters" ("id","tradeFamilyId","tradeId","code","label","sortOrder","isActive","createdAt","updatedAt") VALUES
  ('tk_safety_edu','tf_etc',NULL,'SAFETY_EDUCATION','안전교육',1,true,NOW(),NOW()),
  ('tk_meeting','tf_etc',NULL,'MEETING','회의',2,true,NOW(),NOW()),
  ('tk_standby','tf_etc',NULL,'STANDBY','대기',3,true,NOW(),NOW()),
  ('tk_other','tf_etc',NULL,'OTHER_TASK','기타 작업',99,true,NOW(),NOW());
