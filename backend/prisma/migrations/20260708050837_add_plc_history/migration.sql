-- AlterTable
ALTER TABLE "Device" ADD COLUMN "networkName" TEXT;
ALTER TABLE "Device" ADD COLUMN "networkStrength" INTEGER;
ALTER TABLE "Device" ADD COLUMN "sn" TEXT;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN "deviceId" TEXT;

-- CreateTable
CREATE TABLE "DeviceShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sharedWithId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'read',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceShare_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeviceShare_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeviceShare_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlcRegisterHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "property" TEXT NOT NULL,
    "address" INTEGER NOT NULL,
    "value" REAL NOT NULL,
    "rawValue" REAL NOT NULL,
    "unit" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "DeviceShare_ownerId_idx" ON "DeviceShare"("ownerId");

-- CreateIndex
CREATE INDEX "DeviceShare_sharedWithId_idx" ON "DeviceShare"("sharedWithId");

-- CreateIndex
CREATE INDEX "DeviceShare_deviceId_idx" ON "DeviceShare"("deviceId");

-- CreateIndex
CREATE INDEX "PlcRegisterHistory_deviceId_idx" ON "PlcRegisterHistory"("deviceId");

-- CreateIndex
CREATE INDEX "PlcRegisterHistory_timestamp_idx" ON "PlcRegisterHistory"("timestamp");
