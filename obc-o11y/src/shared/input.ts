import path from 'node:path';
import XLSX from 'xlsx';
import { readJsonFile, readTextFile } from './fs.js';
import { buildEventQueryHint } from './query-hint.js';
import { EventStormingRow, RecognizedFlow } from './types.js';

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

export type PlanningInput = {
  rows: EventStormingRow[];
  recognizedFlows: RecognizedFlow[];
};

export async function readPlanningInput(filePath: string, env?: string): Promise<EventStormingRow[]> {
  return (await readPlanningInputContract(filePath, env)).rows;
}

export async function readPlanningInputContract(filePath: string, env?: string): Promise<PlanningInput> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    const content = await readTextFile(filePath);
    const workbook = XLSX.read(content, { type: 'string' });
    return {
      rows: parseRows(XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })),
      recognizedFlows: []
    };
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

    return {
      rows: parseRows(XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], { defval: '' })),
      recognizedFlows: []
    };
  }

  if (ext === '.json') {
    return parseJsonContract(await readJsonFile<unknown>(filePath), env);
  }

  throw new Error(`Formato não suportado: ${ext}. Use .csv, .xlsx, .xls ou .json`);
}

function parseJsonContract(input: unknown, env?: string): PlanningInput {
  if (Array.isArray(input)) {
    return {
      rows: parseRows(input as RawRow[], env),
      recognizedFlows: []
    };
  }

  if (!input || typeof input !== 'object') {
    throw new Error('Contrato JSON inválido.');
  }

  const object = input as Record<string, unknown>;
  if (Array.isArray(object.rows)) {
    return {
      rows: parseRecognizedRows(object.rows as RawRow[], env),
      recognizedFlows: parseRecognizedFlows(object.recognizedFlows)
    };
  }

  if (Array.isArray(object.candidateEvents)) {
    return {
      rows: (object.candidateEvents as RawRow[]).map((row, index) => ({
        ordem: Number(row.ordem ?? index + 1),
        eventKey: String(row.event_key ?? row.event_title ?? `event_${index + 1}`),
        eventTitle: String(row.event_title ?? '').trim(),
        stage: String(row.stage ?? 'event_storming').trim(),
        actor: String(row.actor ?? 'system').trim(),
        service: String(row.service ?? 'event.storming').trim(),
        tags: String(row.tags ?? 'source:event_storming').split(',').map((item) => item.trim()).filter(Boolean),
        dashboardWidget: 'event_stream',
        queryHint: buildEventQueryHint(String(row.event_key ?? row.event_title ?? `event_${index + 1}`), env),
        sourceTouchPoint: typeof row.source_touch_point === 'string' ? row.source_touch_point.trim() : undefined
      })),
      recognizedFlows: []
    };
  }

  throw new Error('JSON não reconhecido. Esperado array de linhas, objeto com rows ou candidateEvents.');
}

function parseRecognizedFlows(value: unknown): RecognizedFlow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((flow) => ({
      name: String(flow.name ?? '').trim(),
      description: String(flow.description ?? '').trim(),
      stages: Array.isArray(flow.stages) ? flow.stages.map((stage) => String(stage).trim()).filter(Boolean) : [],
      actors: Array.isArray(flow.actors) ? flow.actors.map((actor) => String(actor).trim()).filter(Boolean) : [],
      services: Array.isArray(flow.services) ? flow.services.map((service) => String(service).trim()).filter(Boolean) : [],
      confidence: Number(flow.confidence ?? 0)
    }))
    .filter((flow) => flow.name.length > 0);
}

function parseRecognizedRows(rows: RawRow[], env?: string): EventStormingRow[] {
  return rows.map((row, index) => ({
    ordem: Number(row.ordem ?? index + 1),
    eventKey: String(row.event_key ?? row.eventKey ?? '').trim(),
    eventTitle: String(row.event_title ?? row.eventTitle ?? '').trim(),
    stage: String(row.stage ?? '').trim(),
    actor: String(row.actor ?? '').trim(),
    service: String(row.service ?? '').trim(),
    tags: String(row.tags ?? '').split(',').map((item) => item.trim()).filter(Boolean),
    dashboardWidget: normalizeWidget(row.dashboard_widget ?? row.dashboardWidget),
    queryHint: String(row.query_hint ?? row.queryHint ?? buildEventQueryHint(String(row.event_key ?? row.eventKey ?? ''), env)).trim(),
    sourceRow: typeof row.source_row === 'number' ? row.source_row : null,
    sourceTouchPoint: typeof row.source_touch_point === 'string' ? row.source_touch_point.trim() : undefined
  }));
}

function parseRows(rawRows: RawRow[], env?: string): EventStormingRow[] {
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
    queryHint: String(row.query_hint ?? buildEventQueryHint(String(row.event_key ?? ''), env)).trim(),
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
