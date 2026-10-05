import * as XLSX from 'xlsx';
import { WorkbookPayload, PROJECT_FORMAT_COLUMNS } from '../../domain/event-storming-schema.js';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('workbook-writer');

export function writeWorkbook(workbook: WorkbookPayload, outputFile: string): void {
  logger.info('Gerando workbook XLSX', {
    outputFile,
    sheetName: workbook.sheetName,
    rowCount: workbook.rows.length
  });

  const worksheetRows = workbook.rows.map((row) => ({
    ordem: row.ordem,
    event_key: row.event_key,
    event_title: row.event_title,
    stage: row.stage,
    actor: row.actor,
    service: row.service,
    tags: row.tags,
    dashboard_widget: row.dashboard_widget,
    query_hint: row.query_hint,
    source_row: row.source_row ?? '',
    source_touch_point: row.source_touch_point ?? ''
  }));

  const sheet = XLSX.utils.json_to_sheet(worksheetRows, { header: [...PROJECT_FORMAT_COLUMNS] });
  const notesSheet = XLSX.utils.json_to_sheet(workbook.notes);
  const workbookFile = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbookFile, sheet, workbook.sheetName);
  XLSX.utils.book_append_sheet(workbookFile, notesSheet, 'conversion_notes');
  XLSX.writeFile(workbookFile, outputFile);

  logger.info('Workbook XLSX persistido com sucesso', { outputFile });
}
