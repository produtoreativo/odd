import path from 'node:path';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { EventStormingRow, SupportedWidget } from './types.js';

const REQUIRED_COLUMNS = [
  'ordem',
  'event_key',
  'event_title',
  'stage',
  'actor',
  'service',
  'tags',
  'dashboard_widget',
  'query_hint'
] as const;

const ALLOWED_WIDGETS: SupportedWidget[] = ['event_stream', 'note'];

type RawRow = Record<string, unknown>;

export async function readEventStormingFile(filePath: string): Promise<EventStormingRow[]> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    const content = await readFile(filePath, 'utf-8');
    return parseRows(parseCsv(content));
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath, { cellDates: false });
    const firstSheet = workbook.SheetNames.find((name) => {
      const ws = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '' });
      return rows.length > 0;
    });

    if (!firstSheet) {
      throw new Error('Nenhuma aba com linhas foi encontrada no arquivo XLSX.');
    }

    const rawRows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], { defval: '' });
    return parseRows(rawRows);
  }

  throw new Error(`Formato não suportado: ${ext}. Use .csv, .xlsx ou .xls`);
}

function parseCsv(content: string): RawRow[] {
  const workbook = XLSX.read(content, { type: 'string' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return [];
  }
  return XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], { defval: '' });
}

function parseRows(rawRows: RawRow[]): EventStormingRow[] {
  if (rawRows.length === 0) {
    throw new Error('A planilha está vazia.');
  }

  validateColumns(rawRows[0]);

  return rawRows.map((row, index) => toDomainRow(row, index + 2));
}

function validateColumns(firstRow: RawRow): void {
  const missing = REQUIRED_COLUMNS.filter((column) => !(column in firstRow));
  if (missing.length > 0) {
    throw new Error(`Colunas obrigatórias ausentes: ${missing.join(', ')}`);
  }
}

function toDomainRow(row: RawRow, rowNumber: number): EventStormingRow {
  const dashboardWidget = asString(row.dashboard_widget, rowNumber, 'dashboard_widget') as SupportedWidget;
  if (!ALLOWED_WIDGETS.includes(dashboardWidget)) {
    throw new Error(
      `Valor inválido em dashboard_widget na linha ${rowNumber}: ${dashboardWidget}. Valores suportados: ${ALLOWED_WIDGETS.join(', ')}`
    );
  }

  return {
    ordem: Number(asString(row.ordem, rowNumber, 'ordem')),
    eventKey: asString(row.event_key, rowNumber, 'event_key'),
    eventTitle: asString(row.event_title, rowNumber, 'event_title'),
    stage: asString(row.stage, rowNumber, 'stage'),
    actor: asString(row.actor, rowNumber, 'actor'),
    service: asString(row.service, rowNumber, 'service'),
    tags: asTags(row.tags),
    dashboardWidget,
    queryHint: asString(row.query_hint, rowNumber, 'query_hint')
  };
}

function asString(value: unknown, rowNumber: number, fieldName: string): string {
  const normalized = String(value ?? '').trim();
  if (normalized === '') {
    throw new Error(`Campo obrigatório vazio na linha ${rowNumber}: ${fieldName}`);
  }
  return normalized;
}

function asTags(value: unknown): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
