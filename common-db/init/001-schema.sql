-- ============================================================
-- common_data 스키마 골격 (001-schema.sql)
-- 목적: 공용 건설 기준 데이터 전용 DB
-- 주의: 이 파일은 초기 컨테이너 기동 시 1회만 실행된다.
--       데이터 이관은 별도 마이그레이션 스크립트로 진행한다.
-- ============================================================

-- ──────────────────────────────────────────
-- 1. 조달청 물품단가 (나라장터)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS g2b_standard_price (
    id              SERIAL PRIMARY KEY,
    category_code   VARCHAR(20),
    category_name   VARCHAR(200),
    spec_code       VARCHAR(50),
    spec_name       VARCHAR(500),
    unit            VARCHAR(20),
    unit_price      NUMERIC(15, 2),
    acquired_at     DATE,
    delivery_price  NUMERIC(15, 2),
    source          VARCHAR(20)  NOT NULL DEFAULT 'g2b',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (spec_code, acquired_at)
);

CREATE INDEX IF NOT EXISTS idx_g2b_category  ON g2b_standard_price (category_code);
CREATE INDEX IF NOT EXISTS idx_g2b_acquired  ON g2b_standard_price (acquired_at DESC);

-- ──────────────────────────────────────────
-- 2. 건설기계경비 단가
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS machine_costs (
    id              SERIAL PRIMARY KEY,
    year            SMALLINT    NOT NULL,
    half            SMALLINT    NOT NULL CHECK (half IN (1, 2)),
    category        VARCHAR(100),
    machine_code    VARCHAR(50),
    machine_name    VARCHAR(200) NOT NULL,
    spec            VARCHAR(500),
    unit            VARCHAR(20),
    rental_cost     NUMERIC(12, 2),
    fuel_cost       NUMERIC(12, 2),
    total_cost      NUMERIC(12, 2),
    source          VARCHAR(100),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (year, half, machine_code)
);

-- ──────────────────────────────────────────
-- 3. 노임단가 — 기간 / 직종별 임금
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labor_periods (
    period_code     VARCHAR(20)  PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    start_date      DATE,
    end_date        DATE
);

CREATE TABLE IF NOT EXISTS labor_wages (
    id              SERIAL PRIMARY KEY,
    period_code     VARCHAR(20)  NOT NULL REFERENCES labor_periods (period_code),
    job_type        VARCHAR(200) NOT NULL,
    daily_wage      NUMERIC(10, 0),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (period_code, job_type)
);

CREATE INDEX IF NOT EXISTS idx_labor_period ON labor_wages (period_code);

-- ──────────────────────────────────────────
-- 4. 보험요율 / 제비율
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_rates (
    id              SERIAL PRIMARY KEY,
    year            SMALLINT    NOT NULL,
    rate_type       VARCHAR(50)  NOT NULL,
    industry_type   VARCHAR(100),
    rate            NUMERIC(8, 5),
    base            VARCHAR(200),
    note            TEXT,
    effective_at    DATE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- 5. ECOS 물가지수 (한국은행)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ecos_indices (
    id              SERIAL PRIMARY KEY,
    cost_group      VARCHAR(100),
    period          VARCHAR(10)  NOT NULL,
    value           NUMERIC(10, 3),
    stat_code       VARCHAR(50),
    item_code       VARCHAR(50),
    item_name       VARCHAR(200),
    fetched_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (stat_code, item_code, period)
);

CREATE INDEX IF NOT EXISTS idx_ecos_period ON ecos_indices (period DESC);

-- ──────────────────────────────────────────
-- 6. 표준시장단가 인덱스
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS standard_price_index (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(100),
    period          VARCHAR(10),
    base_index      NUMERIC(10, 3),
    compare_index   NUMERIC(10, 3),
    change_rate     NUMERIC(6, 3),
    source          VARCHAR(100),
    fetched_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- 7. 통합 갱신 이력 로그
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_update_log (
    id              SERIAL PRIMARY KEY,
    data_type       VARCHAR(50)  NOT NULL,
    update_time     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    period_start    VARCHAR(20),
    period_end      VARCHAR(20),
    total_count     INTEGER,
    inserted_count  INTEGER,
    updated_count   INTEGER,
    status          VARCHAR(20)  NOT NULL DEFAULT 'success',
    message         TEXT
);

CREATE INDEX IF NOT EXISTS idx_log_type_time ON data_update_log (data_type, update_time DESC);
