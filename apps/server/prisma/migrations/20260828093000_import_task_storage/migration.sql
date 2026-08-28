-- 保留 OA 审批单原件：确认导入后转为台账附件（kind = OA_DOC）
ALTER TABLE "ImportTask" ADD COLUMN "storagePath" TEXT;
