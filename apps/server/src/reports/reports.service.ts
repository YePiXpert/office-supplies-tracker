import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { recentDays } from '../common/date.util';
import {
  ITEM_STATUSES,
  KANBAN_STATUSES,
  type ItemStatus,
  type ReportPoint,
  type StatusSlice,
} from '@procure-lite/shared';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 仪表盘：状态分布、待办、库存预警、近 7 天趋势 */
  async dashboard() {
    const [items, lowStockProducts, todayLines] = await Promise.all([
      this.prisma.item.findMany({ where: { deletedAt: null } }),
      this.prisma.product.findMany(),
      this.prisma.distributionLine.findMany({
        where: { distribution: { date: recentDays(1)[0] } },
        select: { quantity: true },
      }),
    ]);

    const statusMap = new Map<string, StatusSlice>(
      ITEM_STATUSES.map((s) => [s, { status: s, count: 0, amount: 0 }]),
    );
    let unpaidCount = 0;
    let unpaidAmount = 0;
    let noInvoiceCount = 0;
    for (const item of items) {
      const slice = statusMap.get(item.status);
      if (slice) {
        slice.count += 1;
        slice.amount += this.amountOf(item.unitPrice, item.quantity);
      }
      if (item.paymentStatus === 'UNPAID') {
        unpaidCount += 1;
        unpaidAmount += this.amountOf(item.unitPrice, item.quantity);
      }
      if (!item.invoiceIssued) noInvoiceCount += 1;
    }

    const days = recentDays(7);
    const trend = days.map((date) => ({
      date,
      created: 0,
      distributed: 0,
      distributedAmount: 0,
    }));
    const trendIdx = new Map(trend.map((t) => [t.date, t]));
    for (const item of items) {
      const created = trendIdx.get(item.createdAt.toISOString().slice(0, 10));
      if (created) created.created += 1;
      if (item.distributionDate) {
        const dist = trendIdx.get(item.distributionDate);
        if (dist) {
          dist.distributed += 1;
          dist.distributedAmount += this.amountOf(item.unitPrice, item.quantity);
        }
      }
    }

    const today = recentDays(1)[0];
    const arrivalsToday = items.filter((i) => i.arrivalDate === today).length;

    return {
      statusSlices: [...statusMap.values()],
      kanbanCounts: Object.fromEntries(
        KANBAN_STATUSES.map((s) => [s, statusMap.get(s)?.count ?? 0]),
      ),
      payment: { unpaidCount, unpaidAmount: this.round(unpaidAmount), noInvoiceCount },
      inventory: {
        productCount: lowStockProducts.length,
        lowStockCount: lowStockProducts.filter((p) => p.stockQty <= (p.lowStockThreshold ?? 0)).length,
        totalStockQty: lowStockProducts.reduce((s, p) => s + p.stockQty, 0),
      },
      today: {
        date: today,
        arrivals: arrivalsToday,
        distributionLines: todayLines.length,
        distributedQty: todayLines.reduce((s, l) => s + l.quantity, 0),
      },
      trend,
    };
  }

  /** 金额统计：按月份 / 部门 / 供应商分组 */
  async amount(groupBy: 'month' | 'department' | 'supplier', dateFrom?: string, dateTo?: string) {
    const items = await this.prisma.item.findMany({
      where: {
        deletedAt: null,
        ...(dateFrom || dateTo
          ? {
              requestDate: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
    });

    const buckets = new Map<string, ReportPoint>();
    for (const item of items) {
      const label =
        groupBy === 'month'
          ? item.requestDate.slice(0, 7)
          : groupBy === 'department'
            ? item.department
            : (item.supplierName ?? '未指定供应商');
      const cur = buckets.get(label) ?? { label, amount: 0, count: 0 };
      cur.amount += this.amountOf(item.unitPrice, item.quantity);
      cur.count += 1;
      buckets.set(label, cur);
    }
    return [...buckets.values()]
      .map((p) => ({ ...p, amount: this.round(p.amount) }))
      .sort((a, b) => (groupBy === 'month' ? a.label.localeCompare(b.label) : b.amount - a.amount));
  }

  /** 执行漏斗：申请 → 已下单 → 已到货 → 已发放/入库 */
  async operations(dateFrom?: string, dateTo?: string) {
    const where = {
      deletedAt: null as null,
      ...(dateFrom || dateTo
        ? {
            requestDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };
    const items = await this.prisma.item.findMany({ where });
    const total = items.length;
    const pendingPurchase = items.filter((i) => i.status === 'PENDING_PURCHASE').length;
    const arrived = items.filter((i) => i.arrivalDate).length;
    const closed = items.filter(
      (i) => i.status === ('DISTRIBUTED' satisfies ItemStatus) || i.status === 'STOCKED',
    ).length;
    return { total, pendingPurchase, arrived, closed };
  }

  /** 领用排行（按人） */
  async recipients(dateFrom?: string, dateTo?: string) {
    const lines = await this.prisma.distributionLine.findMany({
      where: {
        distribution: {
          ...(dateFrom || dateTo
            ? {
                date: {
                  ...(dateFrom ? { gte: dateFrom } : {}),
                  ...(dateTo ? { lte: dateTo } : {}),
                },
              }
            : {}),
        },
      },
      select: { recipient: true, quantity: true, distribution: { select: { department: true } } },
    });
    const by = new Map<string, { recipient: string; department: string; quantity: number; times: number }>();
    for (const line of lines) {
      const dept = line.distribution.department ?? '';
      const key = `${line.recipient}|${dept}`;
      const cur = by.get(key) ?? { recipient: line.recipient, department: dept, quantity: 0, times: 0 };
      cur.quantity += line.quantity;
      cur.times += 1;
      by.set(key, cur);
    }
    return [...by.values()].sort((a, b) => b.quantity - a.quantity);
  }

  /** 供应商消耗排行 */
  async suppliers(dateFrom?: string, dateTo?: string) {
    return this.amount('supplier', dateFrom, dateTo);
  }

  private amountOf(unitPrice: number | null, quantity: number): number {
    if (unitPrice == null) return 0;
    return unitPrice * quantity;
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
