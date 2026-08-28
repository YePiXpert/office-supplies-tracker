import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  ITEM_STATUSES,
  PAYMENT_STATUSES,
  type ItemQuery,
  type DistributionQuery,
} from '@procure-lite/shared';
import { ItemsService } from '../items/items.service';
import { InventoryService } from '../inventory/inventory.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { ReportsService } from '../reports/reports.service';
import { DistributionsService } from '../distributions/distributions.service';
import { todayString } from '../common/date.util';
import type { ToolDef } from './llm.client';

const dateArg = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const queryItemsArgs = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  department: z.string().max(64).optional(),
  handler: z.string().max(64).optional(),
  dateFrom: dateArg.optional(),
  dateTo: dateArg.optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
});

const queryDistributionsArgs = z.object({
  search: z.string().max(100).optional(),
  recipient: z.string().max(64).optional(),
  department: z.string().max(64).optional(),
  dateFrom: dateArg.optional(),
  dateTo: dateArg.optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
});

const queryInventoryArgs = z.object({
  search: z.string().max(100).optional(),
  lowOnly: z.boolean().optional(),
});

const queryPriceRecordsArgs = z.object({
  itemName: z.string().max(200).optional(),
  supplierId: z.number().int().positive().optional(),
});

const queryAmountArgs = z.object({
  groupBy: z.enum(['month', 'department', 'supplier']),
  dateFrom: dateArg.optional(),
  dateTo: dateArg.optional(),
});

const reportRangeArgs = z.object({
  dateFrom: dateArg.optional(),
  dateTo: dateArg.optional(),
});

/** 交给 LLM 的工具清单：全部只读，直接复用现有查询服务 */
@Injectable()
export class AiToolsService {
  constructor(
    private readonly items: ItemsService,
    private readonly inventory: InventoryService,
    private readonly suppliers: SuppliersService,
    private readonly reports: ReportsService,
    private readonly distributions: DistributionsService,
  ) {}

  definitions(): ToolDef[] {
    return [
      {
        type: 'function',
        function: {
          name: 'query_items',
          description: '查询采购台账明细。支持按关键字、状态、部门、经办人、申请日期范围过滤分页。',
          parameters: {
            type: 'object',
            properties: {
              search: { type: 'string', description: '关键字，匹配流水号/品名/经办人/部门' },
              status: { type: 'string', enum: [...ITEM_STATUSES], description: 'PENDING_PURCHASE待采购/PENDING_ARRIVAL待到货/PENDING_DISTRIBUTION待分发/DISTRIBUTED已发放/STOCKED已入库' },
              paymentStatus: { type: 'string', enum: [...PAYMENT_STATUSES] },
              department: { type: 'string', description: '申领部门，精确匹配' },
              handler: { type: 'string', description: '经办人，精确匹配' },
              dateFrom: { type: 'string', description: '申请日期起 YYYY-MM-DD' },
              dateTo: { type: 'string', description: '申请日期止 YYYY-MM-DD' },
              page: { type: 'number' },
              pageSize: { type: 'number', description: '≤50' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'query_facets',
          description: '列出系统中已有的申领部门和经办人，用于对齐拼写后再按部门/经办人查询。',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'query_inventory',
          description: '查询库存物品及当前库存量，可只看低库存。',
          parameters: {
            type: 'object',
            properties: {
              search: { type: 'string', description: '物品名关键字' },
              lowOnly: { type: 'boolean', description: '只看库存低于阈值的物品' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'query_suppliers',
          description: '列出全部供应商及其关联台账数、价格记录数。',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'query_price_records',
          description: '查询供应商价格记录（按品名关键字过滤），用于比价。',
          parameters: {
            type: 'object',
            properties: {
              itemName: { type: 'string', description: '品名关键字' },
              supplierId: { type: 'number' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'query_distributions',
          description: '查询领用发放记录，可按领用人/部门/日期范围过滤。',
          parameters: {
            type: 'object',
            properties: {
              search: { type: 'string', description: '领用人关键字' },
              recipient: { type: 'string', description: '领用人关键字' },
              department: { type: 'string', description: '领用部门关键字' },
              dateFrom: { type: 'string' },
              dateTo: { type: 'string' },
              page: { type: 'number' },
              pageSize: { type: 'number', description: '≤50' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'query_report_dashboard',
          description: '仪表盘总览：状态分布、待办、未付款金额、库存预警、近7天趋势。统计类问题优先用这个。',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'query_report_amount',
          description: '采购金额统计，按月份/部门/供应商分组。金额=单价×数量。',
          parameters: {
            type: 'object',
            properties: {
              groupBy: { type: 'string', enum: ['month', 'department', 'supplier'] },
              dateFrom: { type: 'string' },
              dateTo: { type: 'string' },
            },
            required: ['groupBy'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'query_report_recipients',
          description: '领用排行：按领用人统计领用数量与次数。',
          parameters: {
            type: 'object',
            properties: { dateFrom: { type: 'string' }, dateTo: { type: 'string' } },
          },
        },
      },
    ];
  }

  /** 执行一次工具调用；返回值会 JSON 序列化后回给 LLM */
  async execute(name: string, args: Record<string, unknown>): Promise<{ result: unknown; count: number }> {
    switch (name) {
      case 'query_items': {
        const a = queryItemsArgs.parse(args);
        const query: ItemQuery = {
          search: a.search,
          status: a.status,
          paymentStatus: a.paymentStatus,
          department: a.department,
          handler: a.handler,
          dateFrom: a.dateFrom,
          dateTo: a.dateTo,
          page: a.page ?? 1,
          pageSize: a.pageSize ?? 20,
          sort: 'requestDate_desc',
        };
        const page = await this.items.list(query);
        return {
          result: {
            total: page.total,
            page: page.page,
            pageSize: page.pageSize,
            items: page.items.map((i) => ({
              id: i.id,
              serialNumber: i.serialNumber,
              department: i.department,
              handler: i.handler,
              requestDate: i.requestDate,
              itemName: i.itemName,
              quantity: i.quantity,
              unit: i.unit,
              unitPrice: i.unitPrice,
              supplierName: i.supplierName,
              status: i.status,
              paymentStatus: i.paymentStatus,
              invoiceIssued: i.invoiceIssued,
              arrivalDate: i.arrivalDate,
            })),
          },
          count: page.items.length,
        };
      }
      case 'query_facets':
        return { result: await this.items.facets(), count: 1 };
      case 'query_inventory': {
        const a = queryInventoryArgs.parse(args);
        const products = await this.inventory.products(a.search, a.lowOnly);
        return {
          result: products.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            category: p.category,
            stockQty: p.stockQty,
            lowStockThreshold: p.lowStockThreshold,
            isLow: p.isLow,
          })),
          count: products.length,
        };
      }
      case 'query_suppliers': {
        const suppliers = await this.suppliers.list();
        return {
          result: suppliers.map((s) => ({
            id: s.id,
            name: s.name,
            contact: s.contact,
            phone: s.phone,
            itemCount: s._count.items,
            priceRecordCount: s._count.priceRecords,
          })),
          count: suppliers.length,
        };
      }
      case 'query_price_records': {
        const a = queryPriceRecordsArgs.parse(args);
        const records = await this.suppliers.priceRecords(a);
        return {
          result: records.map((r) => ({
            id: r.id,
            itemName: r.itemName,
            unitPrice: r.unitPrice,
            supplierName: r.supplier.name,
            purchaseLink: r.purchaseLink,
            createdAt: r.createdAt,
          })),
          count: records.length,
        };
      }
      case 'query_distributions': {
        const a = queryDistributionsArgs.parse(args);
        const query: DistributionQuery = {
          ...a,
          page: a.page ?? 1,
          pageSize: a.pageSize ?? 20,
        };
        const page = await this.distributions.list(query);
        return {
          result: {
            total: page.total,
            page: page.page,
            pageSize: page.pageSize,
            distributions: page.distributions.map((d) => ({
              id: d.id,
              date: d.date,
              source: d.source,
              department: d.department,
              note: d.note,
              lines: d.lines.map((l) => ({
                itemName: l.itemName,
                recipient: l.recipient,
                quantity: l.quantity,
                signoffNote: l.signoffNote,
              })),
            })),
          },
          count: page.distributions.length,
        };
      }
      case 'query_report_dashboard':
        return { result: await this.reports.dashboard(), count: 1 };
      case 'query_report_amount': {
        const a = queryAmountArgs.parse(args);
        return { result: await this.reports.amount(a.groupBy, a.dateFrom, a.dateTo), count: 1 };
      }
      case 'query_report_recipients': {
        const a = reportRangeArgs.parse(args);
        return { result: await this.reports.recipients(a.dateFrom, a.dateTo), count: 1 };
      }
      default:
        throw new Error(`未知工具 ${name}`);
    }
  }

  /** 问答的 system 提示词：领域说明 + 回答规则 */
  systemPrompt(): string {
    return [
      '你是「Procure Lite」办公用品采购台账的查询助手。今天日期 ' + todayString() + '。',
      '系统数据模型：',
      '- 台账 Item：流水号 serialNumber、申领部门 department、经办人 handler、申请日期 requestDate(YYYY-MM-DD)、品名 itemName、数量 quantity、单位 unit、单价 unitPrice、供应商 supplierName、状态 status(待采购/待到货/待分发/已发放/已入库)、付款状态 paymentStatus(未付款/已付款/已报销)、开票 invoiceIssued。金额=单价×数量，单价缺失按 0 计。',
      '- 库存 Product：物品名、当前库存量 stockQty、低库存阈值 lowStockThreshold。',
      '- 发放 Distribution：按领用人 recipient 拆分发放明细。',
      '回答规则：',
      '1. 统计/汇总问题优先用 query_report_* 聚合工具，避免拉全量明细。',
      '2. 按部门或经办人查询前，若不确定拼写先用 query_facets 对齐。',
      '3. 所有数字必须来自工具返回结果，禁止编造；查不到就直说没有数据。',
      '4. 用简体中文回答，简洁直接；金额保留两位小数；涉及多条记录时用简短列表呈现。',
    ].join('\n');
  }
}
