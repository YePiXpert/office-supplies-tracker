import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ItemsService } from './items.service';
import {
  ITEM_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type ItemQuery,
  type ItemStatus,
  type PaymentStatus,
} from '@procure-lite/shared';

/** 导出行结构（Prisma 记录在响应序列化后日期为字符串） */
interface ExportRow {
  serialNumber: string;
  department: string;
  handler: string;
  requestDate: string;
  itemName: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  supplierName: string | null;
  purchaseLink: string | null;
  status: string;
  arrivalDate: string | null;
  distributionDate: string | null;
  invoiceIssued: boolean;
  paymentStatus: string;
  signoffNote: string | null;
  note: string | null;
  createdAt: Date | string;
  supplier?: { name: string } | null;
}

type ItemWithSupplier = ExportRow;

const COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: '流水号', key: 'serialNumber', width: 16 },
  { header: '申领部门', key: 'department', width: 14 },
  { header: '经办人', key: 'handler', width: 10 },
  { header: '申请日期', key: 'requestDate', width: 12 },
  { header: '品名', key: 'itemName', width: 28 },
  { header: '数量', key: 'quantity', width: 8 },
  { header: '单位', key: 'unit', width: 8 },
  { header: '单价', key: 'unitPrice', width: 10 },
  { header: '金额', key: 'amount', width: 12 },
  { header: '供应商', key: 'supplier', width: 14 },
  { header: '采购链接', key: 'purchaseLink', width: 40 },
  { header: '状态', key: 'status', width: 10 },
  { header: '到货日期', key: 'arrivalDate', width: 12 },
  { header: '发放日期', key: 'distributionDate', width: 12 },
  { header: '发票', key: 'invoiceIssued', width: 8 },
  { header: '付款状态', key: 'paymentStatus', width: 10 },
  { header: '签收备注', key: 'signoffNote', width: 20 },
  { header: '备注', key: 'note', width: 20 },
  { header: '创建时间', key: 'createdAt', width: 18 },
];

@Injectable()
export class ExportService {
  constructor(private readonly items: ItemsService) {}

  async exportLedger(query: ItemQuery): Promise<Buffer> {
    const rows = await this.items.findManyForExport(query);
    return this.buildWorkbook(rows);
  }

  async buildWorkbook(rows: ItemWithSupplier[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Procure Lite';
    const sheet = workbook.addWorksheet('采购台账');
    sheet.columns = COLUMNS;

    // 表头样式
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FF14213D' } };
    header.height = 22;

    for (const item of rows) {
      const unitPrice = item.unitPrice ?? null;
      const quantity = item.quantity ?? null;
      sheet.addRow({
        serialNumber: item.serialNumber,
        department: item.department,
        handler: item.handler,
        requestDate: item.requestDate,
        itemName: item.itemName,
        quantity,
        unit: item.unit ?? '',
        unitPrice,
        amount: unitPrice != null && quantity != null ? Number((unitPrice * quantity).toFixed(2)) : null,
        supplier: item.supplierName ?? item.supplier?.name ?? '',
        purchaseLink: item.purchaseLink ?? '',
        status: ITEM_STATUS_LABELS[item.status as ItemStatus] ?? item.status,
        arrivalDate: item.arrivalDate ?? '',
        distributionDate: item.distributionDate ?? '',
        invoiceIssued: item.invoiceIssued ? '已开票' : '',
        paymentStatus: PAYMENT_STATUS_LABELS[item.paymentStatus as PaymentStatus] ?? item.paymentStatus,
        signoffNote: item.signoffNote ?? '',
        note: item.note ?? '',
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
