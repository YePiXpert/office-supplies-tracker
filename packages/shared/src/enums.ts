/** 台账状态流转：待采购 → 待到货 → 待分发 → 已发放 / 已入库 */
export const ITEM_STATUSES = [
  'PENDING_PURCHASE',
  'PENDING_ARRIVAL',
  'PENDING_DISTRIBUTION',
  'DISTRIBUTED',
  'STOCKED',
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  PENDING_PURCHASE: '待采购',
  PENDING_ARRIVAL: '待到货',
  PENDING_DISTRIBUTION: '待分发',
  DISTRIBUTED: '已发放',
  STOCKED: '已入库',
};

/** 看板列只展示执行中的三个状态 */
export const KANBAN_STATUSES: readonly ItemStatus[] = [
  'PENDING_PURCHASE',
  'PENDING_ARRIVAL',
  'PENDING_DISTRIBUTION',
];

/** 付款状态 */
export const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'REIMBURSED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: '未付款',
  PAID: '已付款',
  REIMBURSED: '已报销',
};

/** 库存流水类型；quantity 统一存带符号增量 */
export const MOVEMENT_TYPES = ['INBOUND', 'OUTBOUND', 'ADJUSTMENT'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  INBOUND: '入库',
  OUTBOUND: '出库发放',
  ADJUSTMENT: '盘点调整',
};

/** 发放来源：DIRECT 直接发放（关联台账），STOCK 从库存出库 */
export const DISTRIBUTION_SOURCES = ['DIRECT', 'STOCK'] as const;
export type DistributionSource = (typeof DISTRIBUTION_SOURCES)[number];

export const DISTRIBUTION_SOURCE_LABELS: Record<DistributionSource, string> = {
  DIRECT: '采购直发',
  STOCK: '库存发放',
};

/** 状态语义色（沿用设计体系令牌） */
export const ITEM_STATUS_TONES: Record<ItemStatus, 'blue' | 'amber' | 'teal' | 'gray'> = {
  PENDING_PURCHASE: 'blue',
  PENDING_ARRIVAL: 'amber',
  PENDING_DISTRIBUTION: 'blue',
  DISTRIBUTED: 'teal',
  STOCKED: 'gray',
};
