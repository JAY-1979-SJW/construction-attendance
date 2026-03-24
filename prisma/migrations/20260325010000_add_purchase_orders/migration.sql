-- ─── PurchaseOrderStatus enum ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "PurchaseOrderStatus" AS ENUM (
    'DRAFT','ISSUED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── purchase_orders ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id"                    TEXT          NOT NULL,
  "orderNo"               TEXT          NOT NULL,
  "materialRequestId"     TEXT          NOT NULL,
  "siteId"                TEXT,
  "vendorId"              TEXT,
  "status"                "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "orderedByUserId"       TEXT          NOT NULL,
  "orderedAt"             TIMESTAMPTZ,
  "issuedAt"              TIMESTAMPTZ,
  "cancelledAt"           TIMESTAMPTZ,
  "deliveryRequestedDate" DATE,
  "memo"                  TEXT,
  "createdAt"             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_orderNo_key"
  ON "purchase_orders"("orderNo");
CREATE INDEX IF NOT EXISTS "purchase_orders_materialRequestId_idx"
  ON "purchase_orders"("materialRequestId");
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx"
  ON "purchase_orders"("status");
CREATE INDEX IF NOT EXISTS "purchase_orders_siteId_idx"
  ON "purchase_orders"("siteId");

ALTER TABLE "purchase_orders"
  DROP CONSTRAINT IF EXISTS "purchase_orders_materialRequestId_fkey";
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_materialRequestId_fkey"
  FOREIGN KEY ("materialRequestId") REFERENCES "material_requests"("id") ON DELETE RESTRICT;

ALTER TABLE "purchase_orders"
  DROP CONSTRAINT IF EXISTS "purchase_orders_siteId_fkey";
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL;

-- ─── purchase_order_items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  "id"                        TEXT          NOT NULL,
  "purchaseOrderId"           TEXT          NOT NULL,
  "materialRequestItemId"     TEXT          NOT NULL,
  "materialId"                TEXT,
  "orderedQuantity"           DECIMAL(15,4) NOT NULL,
  "receivedQuantity"          DECIMAL(15,4) NOT NULL DEFAULT 0,
  "note"                      TEXT,
  "itemNameSnapshot"          TEXT          NOT NULL,
  "specSnapshot"              TEXT,
  "unitSnapshot"              TEXT,
  "disciplineCodeSnapshot"    TEXT,
  "subDisciplineCodeSnapshot" TEXT,
  "requestQuantitySnapshot"   DECIMAL(15,4) NOT NULL,
  "requestNoteSnapshot"       TEXT,
  "createdAt"                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "purchase_order_items_purchaseOrderId_idx"
  ON "purchase_order_items"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "purchase_order_items_materialRequestItemId_idx"
  ON "purchase_order_items"("materialRequestItemId");

ALTER TABLE "purchase_order_items"
  DROP CONSTRAINT IF EXISTS "purchase_order_items_purchaseOrderId_fkey";
ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE;

ALTER TABLE "purchase_order_items"
  DROP CONSTRAINT IF EXISTS "purchase_order_items_materialRequestItemId_fkey";
ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_materialRequestItemId_fkey"
  FOREIGN KEY ("materialRequestItemId") REFERENCES "material_request_items"("id") ON DELETE RESTRICT;

-- ─── purchase_order_status_histories ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "purchase_order_status_histories" (
  "id"              TEXT          NOT NULL,
  "purchaseOrderId" TEXT          NOT NULL,
  "fromStatus"      "PurchaseOrderStatus",
  "toStatus"        "PurchaseOrderStatus" NOT NULL,
  "changedByUserId" TEXT,
  "reason"          TEXT,
  "createdAt"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "purchase_order_status_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "purchase_order_status_histories_purchaseOrderId_idx"
  ON "purchase_order_status_histories"("purchaseOrderId");

ALTER TABLE "purchase_order_status_histories"
  DROP CONSTRAINT IF EXISTS "purchase_order_status_histories_purchaseOrderId_fkey";
ALTER TABLE "purchase_order_status_histories"
  ADD CONSTRAINT "purchase_order_status_histories_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE;
