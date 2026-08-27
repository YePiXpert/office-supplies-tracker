-- CreateTable
CREATE TABLE "Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serialNumber" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "handler" TEXT NOT NULL,
    "requestDate" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT,
    "purchaseLink" TEXT,
    "unitPrice" REAL,
    "supplierId" INTEGER,
    "supplierName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PURCHASE',
    "invoiceIssued" BOOLEAN NOT NULL DEFAULT false,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "arrivalDate" TEXT,
    "distributionDate" TEXT,
    "signoffNote" TEXT,
    "note" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "changedFields" TEXT,
    "beforeData" TEXT,
    "afterData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" INTEGER,
    "detail" TEXT,
    "operatorIp" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "department" TEXT,
    "note" TEXT,
    "totalQuantity" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DistributionLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "distributionId" INTEGER NOT NULL,
    "itemId" INTEGER,
    "productId" INTEGER,
    "itemName" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "signoffNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DistributionLine_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "Distribution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DistributionLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DistributionLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "category" TEXT,
    "stockQty" REAL NOT NULL DEFAULT 0,
    "lowStockThreshold" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "relatedItemId" INTEGER,
    "relatedDistributionId" INTEGER,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupplierPriceRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supplierId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "unitPrice" REAL NOT NULL,
    "purchaseLink" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierPriceRecord_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "itemId" INTEGER,
    "distributionId" INTEGER,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "Distribution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SystemSecurity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "passwordHash" TEXT NOT NULL,
    "recoveryCodeHash" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Item_status_deletedAt_createdAt_idx" ON "Item"("status", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Item_department_deletedAt_idx" ON "Item"("department", "deletedAt");

-- CreateIndex
CREATE INDEX "Item_handler_idx" ON "Item"("handler");

-- CreateIndex
CREATE INDEX "Item_requestDate_idx" ON "Item"("requestDate");

-- CreateIndex
CREATE INDEX "Item_supplierId_idx" ON "Item"("supplierId");

-- CreateIndex
CREATE INDEX "Item_deletedAt_createdAt_idx" ON "Item"("deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Item_serialNumber_itemName_handler_key" ON "Item"("serialNumber", "itemName", "handler");

-- CreateIndex
CREATE INDEX "ItemHistory_itemId_createdAt_idx" ON "ItemHistory"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Distribution_date_idx" ON "Distribution"("date");

-- CreateIndex
CREATE INDEX "Distribution_department_idx" ON "Distribution"("department");

-- CreateIndex
CREATE INDEX "Distribution_createdAt_idx" ON "Distribution"("createdAt");

-- CreateIndex
CREATE INDEX "DistributionLine_recipient_idx" ON "DistributionLine"("recipient");

-- CreateIndex
CREATE INDEX "DistributionLine_itemId_idx" ON "DistributionLine"("itemId");

-- CreateIndex
CREATE INDEX "DistributionLine_productId_idx" ON "DistributionLine"("productId");

-- CreateIndex
CREATE INDEX "DistributionLine_distributionId_idx" ON "DistributionLine"("distributionId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_type_idx" ON "InventoryMovement"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "SupplierPriceRecord_itemName_idx" ON "SupplierPriceRecord"("itemName");

-- CreateIndex
CREATE INDEX "SupplierPriceRecord_supplierId_createdAt_idx" ON "SupplierPriceRecord"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_itemId_idx" ON "Attachment"("itemId");

-- CreateIndex
CREATE INDEX "Attachment_distributionId_idx" ON "Attachment"("distributionId");
