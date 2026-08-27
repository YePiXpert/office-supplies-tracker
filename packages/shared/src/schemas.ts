import { z } from 'zod';
import {
  DISTRIBUTION_SOURCES,
  ITEM_STATUSES,
  MOVEMENT_TYPES,
  PAYMENT_STATUSES,
} from './enums.js';

/** YYYY-MM-DD 本地日期字符串 */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD');
export type DateString = z.infer<typeof dateString>;

const positiveNumber = z.coerce.number().positive();
const nonNegativeNumber = z.coerce.number().nonnegative();

/* ---------------------------------- 台账 ---------------------------------- */

export const itemCreateSchema = z.object({
  serialNumber: z.string().trim().min(1, '流水号不能为空').max(64),
  department: z.string().trim().min(1, '申领部门不能为空').max(64),
  handler: z.string().trim().min(1, '经办人不能为空').max(64),
  requestDate: dateString,
  itemName: z.string().trim().min(1, '品名不能为空').max(200),
  quantity: positiveNumber,
  unit: z.string().trim().max(16).optional(),
  purchaseLink: z.string().trim().max(500).optional(),
  unitPrice: nonNegativeNumber.optional(),
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  /** 初始状态（默认待采购） */
  status: z.enum(ITEM_STATUSES).optional(),
  note: z.string().trim().max(500).optional(),
});
export type ItemCreateInput = z.infer<typeof itemCreateSchema>;

export const itemUpdateSchema = itemCreateSchema.partial().extend({
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  invoiceIssued: z.boolean().optional(),
  arrivalDate: dateString.optional(),
  distributionDate: dateString.optional().nullable(),
});
export type ItemUpdateInput = z.infer<typeof itemUpdateSchema>;

export const itemQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  department: z.string().trim().max(64).optional(),
  handler: z.string().trim().max(64).optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
  deleted: z.enum(['only', 'include']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  sort: z
    .enum(['createdAt_desc', 'createdAt_asc', 'requestDate_desc', 'requestDate_asc'])
    .default('createdAt_desc'),
});
export type ItemQuery = z.infer<typeof itemQuerySchema>;

export const batchUpdateSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1, '请选择记录'),
  patch: z.object({
    status: z.enum(ITEM_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    invoiceIssued: z.boolean().optional(),
    arrivalDate: dateString.optional(),
    supplierId: z.coerce.number().int().positive().nullable().optional(),
  }),
});
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;

/* ---------------------------------- 发放 ---------------------------------- */

export const distributionLineSchema = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
  itemName: z.string().trim().min(1).max(200),
  recipient: z.string().trim().min(1, '领用人不能为空').max(64),
  quantity: positiveNumber,
  signoffNote: z.string().trim().max(200).optional(),
});

export const distributionCreateSchema = z
  .object({
    date: dateString,
    source: z.enum(DISTRIBUTION_SOURCES),
    department: z.string().trim().max(64).optional(),
    note: z.string().trim().max(500).optional(),
    lines: z.array(distributionLineSchema).min(1, '至少一条领用明细'),
  })
  .refine((v) => v.lines.every((l) => (l.itemId ? !l.productId : !!l.productId || v.source === 'DIRECT')), {
    message: '明细必须关联台账记录或库存物品',
  });
export type DistributionCreateInput = z.infer<typeof distributionCreateSchema>;

export const distributionQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  recipient: z.string().trim().max(64).optional(),
  department: z.string().trim().max(64).optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
export type DistributionQuery = z.infer<typeof distributionQuerySchema>;

/* ---------------------------------- 库存 ---------------------------------- */

export const productUpsertSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, '品名不能为空').max(200),
  unit: z.string().trim().max(16).optional(),
  category: z.string().trim().max(64).optional(),
  lowStockThreshold: nonNegativeNumber.optional(),
});
export type ProductUpsertInput = z.infer<typeof productUpsertSchema>;

export const movementCreateSchema = z.object({
  productId: z.coerce.number().int().positive(),
  type: z.enum(MOVEMENT_TYPES),
  /** 带符号增量：入库为正、出库为负、盘点可正可负 */
  quantity: z.coerce.number(),
  note: z.string().trim().max(200).optional(),
});
export type MovementCreateInput = z.infer<typeof movementCreateSchema>;

export const movementQuerySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  type: z.enum(MOVEMENT_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
export type MovementQuery = z.infer<typeof movementQuerySchema>;

/* --------------------------------- 供应商 --------------------------------- */

export const supplierUpsertSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, '供应商名称不能为空').max(120),
  contact: z.string().trim().max(64).optional(),
  phone: z.string().trim().max(32).optional(),
  note: z.string().trim().max(500).optional(),
});
export type SupplierUpsertInput = z.infer<typeof supplierUpsertSchema>;

export const priceRecordSchema = z.object({
  supplierId: z.coerce.number().int().positive(),
  itemName: z.string().trim().min(1, '品名不能为空').max(200),
  unitPrice: positiveNumber,
  purchaseLink: z.string().trim().max(500).optional(),
});
export type PriceRecordInput = z.infer<typeof priceRecordSchema>;

/* ---------------------------------- 认证 ---------------------------------- */

export const setupSchema = z.object({
  password: z.string().min(8, '密码至少 8 位').max(128),
});
export const loginSchema = z.object({
  password: z.string().min(1, '请输入密码').max(128),
});
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, '新密码至少 8 位').max(128),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: '新密码不能与当前密码相同',
  });

/* --------------------------------- OA 导入 --------------------------------- */

/** OCR 服务解析结果的结构 */
export const parsedItemSchema = z.object({
  itemName: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  purchaseLink: z.string().trim().max(500).optional(),
});

export const parseResultSchema = z.object({
  serialNumber: z.string().optional(),
  department: z.string().optional(),
  handler: z.string().optional(),
  requestDate: dateString.optional(),
  items: z.array(parsedItemSchema),
  warnings: z.array(z.string()),
  mode: z.enum(['PDF_TEXT', 'PDF_OCR', 'IMAGE_OCR', 'PDF_MIXED', 'TEXT']),
});
export type ParseResult = z.infer<typeof parseResultSchema>;

export const importConfirmSchema = z.object({
  serialNumber: z.string().trim().min(1, '流水号不能为空').max(64),
  department: z.string().trim().min(1, '部门不能为空').max(64),
  handler: z.string().trim().min(1, '经办人不能为空').max(64),
  requestDate: dateString,
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  items: z
    .array(
      parsedItemSchema.extend({
        /** 与已有台账重复时的处理：skip 跳过 / merge 数量累加 */
        duplicateAction: z.enum(['skip', 'merge']).optional(),
      }),
    )
    .min(1, '没有可导入的明细'),
});
export type ImportConfirmInput = z.infer<typeof importConfirmSchema>;

/** 重复检查的响应行 */
export interface DuplicatePreview {
  itemName: string;
  matchedId: number;
  matchedQuantity: number;
  matchedStatus: string;
}

/* ---------------------------------- 报表 ---------------------------------- */

export const reportQuerySchema = z.object({
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export interface ReportPoint {
  label: string;
  amount: number;
  count: number;
}

export interface StatusSlice {
  status: string;
  count: number;
  amount: number;
}

/* ---------------------------------- 备份 ---------------------------------- */

export const autoBackupConfigSchema = z.object({
  enabled: z.boolean(),
  intervalHours: z.coerce.number().int().min(1).max(720),
  keepCount: z.coerce.number().int().min(1).max(100),
});
export type AutoBackupConfig = z.infer<typeof autoBackupConfigSchema>;
