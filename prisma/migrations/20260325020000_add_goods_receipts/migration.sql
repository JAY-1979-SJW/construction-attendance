-- 입고/검수 테이블 추가 (migration: 20260325020000_add_goods_receipts)

CREATE TABLE "goods_receipts" (
  "id"               TEXT NOT NULL,
  "receiptNo"        TEXT NOT NULL,
  "purchaseOrderId"  TEXT NOT NULL,
  "receivedByUserId" TEXT NOT NULL,
  "receivedAt"       TIMESTAMP(3) NOT NULL,
  "memo"             TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goods_receipts_receiptNo_key" ON "goods_receipts"("receiptNo");
CREATE INDEX "goods_receipts_purchaseOrderId_idx" ON "goods_receipts"("purchaseOrderId");

CREATE TABLE "goods_receipt_items" (
  "id"              TEXT NOT NULL,
  "goodsReceiptId"  TEXT NOT NULL,
  "poItemId"        TEXT NOT NULL,
  "quantity"        DECIMAL(15,4) NOT NULL,
  "inspectionNote"  TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goods_receipt_items_goodsReceiptId_idx" ON "goods_receipt_items"("goodsReceiptId");
CREATE INDEX "goods_receipt_items_poItemId_idx" ON "goods_receipt_items"("poItemId");

ALTER TABLE "goods_receipts"
  ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_items"
  ADD CONSTRAINT "goods_receipt_items_goodsReceiptId_fkey"
  FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_items"
  ADD CONSTRAINT "goods_receipt_items_poItemId_fkey"
  FOREIGN KEY ("poItemId") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
