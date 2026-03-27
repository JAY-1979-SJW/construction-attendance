-- CreateTable
CREATE TABLE "worker_notifications" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "referenceId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "pushSent" BOOLEAN NOT NULL DEFAULT false,
    "pushSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "worker_notifications_workerId_isRead_idx" ON "worker_notifications"("workerId", "isRead");
CREATE INDEX "worker_notifications_workerId_createdAt_idx" ON "worker_notifications"("workerId", "createdAt");

-- AddForeignKey
ALTER TABLE "worker_notifications" ADD CONSTRAINT "worker_notifications_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
