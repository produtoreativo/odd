import path from 'node:path';
import XLSX from 'xlsx';
import { readJsonFile, readTextFile } from './fs.js';
import { EventStormingRow } from './types.js';

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

type RawRow = Record<string, unknown>;

export async function readPlanningInput(filePath: string): Promise<EventStormingRow[]> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    const content = await readTextFile(filePath);
    const workbook = XLSX.read(content, { type: 'string' });
    return parseRows(XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' }));
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath, { cellDates: false });
    const firstSheet = workbook.SheetNames.find((sheetName) => {
      const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], { defval: '' });
      return rows.length > 0;
    });
    if (!firstSheet) {
      throw new Error('Nenhuma aba com linhas foi encontrada no XLSX.');
    }

    return parseRows(XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], { defval: '' }));
  }

  if (ext === '.json') {
    return parseJsonContract(await readJsonFile<unknown>(filePath));
  }

  throw new Error(`Formato não suportado: ${ext}. Use .csv, .xlsx, .xls ou .json`);
}

function parseJsonContract(input: unknown): EventStormingRow[] {
  if (Array.isArray(input)) {
    return parseRows(input as RawRow[]);
  }

  if (!input || typeof input !== 'object') {
    throw new Error('Contrato JSON inválido.');
  }

  const object = input as Record<string, unknown>;
  if (Array.isArray(object.rows)) {
    return parseRecognizedRows(object.rows as RawRow[]);
  }

  if (Array.isArray(object.candidateEvents)) {
    return (object.candidateEvents as RawRow[]).map((row, index) => ({
      ordem: Number(row.ordem ?? index + 1),
      eventKey: String(row.event_key ?? row.event_title ?? `event_${index + 1}`),
      eventTitle: String(row.event_title ?? '').trim(),
      stage: String(row.stage ?? 'event_storming').trim(),
      actor: String(row.actor ?? 'system').trim(),
      service: String(row.service ?? 'event.storming').trim(),
      tags: String(row.tags ?? 'source:event_storming').split(',').map((item) => item.trim()).filter(Boolean),
      dashboardWidget: 'event_stream',
      queryHint: `tags:(event_key:${String(row.event_key ?? row.event_title ?? `event_${index + 1}`)} source:odd)`,
      sourceTouchPoint: typeof row.source_touch_point === 'string' ? row.source_touch_point.trim() : undefined
    }));
  }

  throw new Error('JSON não reconhecido. Esperado array de linhas, objeto com rows ou candidateEvents.');
}

function parseRecognizedRows(rows: RawRow[]): EventStormingRow[] {
  return rows.map((row, index) => ({
    ordem: Number(row.ordem ?? index + 1),
    eventKey: String(row.event_key ?? row.eventKey ?? '').trim(),
    eventTitle: String(row.event_title ?? row.eventTitle ?? '').trim(),
    stage: String(row.stage ?? '').trim(),
    actor: String(row.actor ?? '').trim(),
    service: String(row.service ?? '').trim(),
    tags: String(row.tags ?? '').split(',').map((item) => item.trim()).filter(Boolean),
    dashboardWidget: normalizeWidget(row.dashboard_widget ?? row.dashboardWidget),
    queryHint: String(row.query_hint ?? row.queryHint ?? `tags:(event_key:${String(row.event_key ?? row.eventKey ?? '')} source:odd)`).trim(),
    sourceRow: typeof row.source_row === 'number' ? row.source_row : null,
    sourceTouchPoint: typeof row.source_touch_point === 'string' ? row.source_touch_point.trim() : undefined
  }));
}

function parseRows(rawRows: RawRow[]): EventStormingRow[] {
  if (rawRows.length === 0) {
    throw new Error('A entrada está vazia.');
  }

  const missing = REQUIRED_COLUMNS.filter((column) => !(column in rawRows[0]));
  if (missing.length > 0) {
    throw new Error(`Colunas obrigatórias ausentes: ${missing.join(', ')}`);
  }

  return rawRows.map((row, index) => ({
    ordem: Number(String(row.ordem ?? '').trim()),
    eventKey: String(row.event_key ?? '').trim(),
    eventTitle: String(row.event_title ?? '').trim(),
    stage: String(row.stage ?? '').trim(),
    actor: String(row.actor ?? '').trim(),
    service: String(row.service ?? '').trim(),
    tags: String(row.tags ?? '').split(',').map((item) => item.trim()).filter(Boolean),
    dashboardWidget: normalizeWidget(row.dashboard_widget),
    queryHint: String(row.query_hint ?? '').trim(),
    sourceRow: typeof row.source_row === 'number' ? row.source_row : null,
    sourceTouchPoint: typeof row.source_touch_point === 'string' ? row.source_touch_point.trim() : undefined
  })).map((row, index) => {
    if (!Number.isFinite(row.ordem) || row.ordem <= 0) {
      throw new Error(`ordem inválida na linha ${index + 2}`);
    }
    return row;
  });
}

function normalizeWidget(value: unknown): EventStormingRow['dashboardWidget'] {
  const widget = String(value ?? 'event_stream').trim() as EventStormingRow['dashboardWidget'];
  if (widget === 'event_stream' || widget === 'note' || widget === 'query_value' || widget === 'timeseries') {
    return widget;
  }
  throw new Error(`dashboard_widget inválido: ${widget}`);
}
