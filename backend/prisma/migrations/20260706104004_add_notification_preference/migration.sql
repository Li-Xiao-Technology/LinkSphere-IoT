-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "deviceOffline" BOOLEAN NOT NULL DEFAULT true,
    "deviceOnline" BOOLEAN NOT NULL DEFAULT false,
    "warning" BOOLEAN NOT NULL DEFAULT true,
    "info" BOOLEAN NOT NULL DEFAULT false,
    "ruleTriggered" BOOLEAN NOT NULL DEFAULT true,
    "firmwareUpdate" BOOLEAN NOT NULL DEFAULT true,
    "scheduleExecuted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
