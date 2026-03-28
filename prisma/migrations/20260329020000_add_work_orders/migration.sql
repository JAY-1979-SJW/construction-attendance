-- 작업지시문 enum
CREATE TYPE "WorkOrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "WorkOrderScope" AS ENUM ('ALL_SITE', 'SPECIFIC_TRADE', 'SPECIFIC_WORKER');
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'ISSUED', 'COMPLETED', 'CANCELLED');

-- 작업지시문 테이블
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "orderDate" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "issuedById" TEXT NOT NULL,
    "targetScope" "WorkOrderScope" NOT NULL DEFAULT 'ALL_SITE',
    "targetWorkerId" TEXT,
    "targetTradeType" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'ISSUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- 수신 확인 테이블
CREATE TABLE "work_order_acks" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    CONSTRAINT "work_order_acks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_orders_siteId_orderDate_idx" ON "work_orders"("siteId", "orderDate");
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");
CREATE UNIQUE INDEX "work_order_acks_workOrderId_workerId_key" ON "work_order_acks"("workOrderId", "workerId");

ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_targetWorkerId_fkey" FOREIGN KEY ("targetWorkerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_order_acks" ADD CONSTRAINT "work_order_acks_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_order_acks" ADD CONSTRAINT "work_order_acks_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
