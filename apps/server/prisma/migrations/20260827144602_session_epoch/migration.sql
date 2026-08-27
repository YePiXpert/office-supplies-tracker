-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SystemSecurity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "passwordHash" TEXT NOT NULL,
    "recoveryCodeHash" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "sessionEpoch" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SystemSecurity" ("failedAttempts", "id", "lockedUntil", "passwordHash", "recoveryCodeHash", "updatedAt") SELECT "failedAttempts", "id", "lockedUntil", "passwordHash", "recoveryCodeHash", "updatedAt" FROM "SystemSecurity";
DROP TABLE "SystemSecurity";
ALTER TABLE "new_SystemSecurity" RENAME TO "SystemSecurity";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
