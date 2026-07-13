-- CreateTable
CREATE TABLE "RuleExecutionHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "message" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleExecutionHistory_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RuleExecutionHistory_ruleId_idx" ON "RuleExecutionHistory"("ruleId");

-- CreateIndex
CREATE INDEX "RuleExecutionHistory_executedAt_idx" ON "RuleExecutionHistory"("executedAt");
