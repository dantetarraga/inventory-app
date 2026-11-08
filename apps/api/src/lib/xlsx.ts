import ExcelJS from 'exceljs';
import type { FastifyReply } from 'fastify';
import { dates } from '@stockpro/shared';

export interface XlsxColumn<T> {
  header: string;
  key: keyof T & string;
  width?: number;
  numeric?: boolean;
}

export async function sendXlsx<T extends Record<string, unknown>>(
  reply: FastifyReply,
  opts: { filename: string; sheet: string; title: string; columns: XlsxColumn<T>[]; rows: T[] },
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'StockPRO';
  const ws = wb.addWorksheet(opts.sheet);
  ws.columns = opts.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const row of opts.rows) {
    ws.addRow(
      Object.fromEntries(
        opts.columns.map((c) => {
          const v = row[c.key];
          return [c.key, c.numeric && v !== null && v !== undefined ? Number(v) : v];
        }),
      ),
    );
  }
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const date = dates.today();
  return reply
    .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('content-disposition', `attachment; filename="${opts.filename}-${date}.xlsx"`)
    .send(buffer);
}
