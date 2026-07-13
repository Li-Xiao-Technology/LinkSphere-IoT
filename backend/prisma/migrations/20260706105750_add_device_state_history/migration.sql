-- CreateTable
CREATE TABLE "DeviceStateHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "state" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceStateHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DeviceStateHistory_deviceId_idx" ON "DeviceStateHistory"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceStateHistory_changedAt_idx" ON "DeviceStateHistory"("changedAt");
