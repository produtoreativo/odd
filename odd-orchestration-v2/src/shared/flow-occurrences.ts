import { EventStormingRow, FlowOccurrence, RecognizedFlow } from './types.js';

export function buildFlowOccurrences(rows: EventStormingRow[], recognizedFlows: RecognizedFlow[]): FlowOccurrence[] {
  if (recognizedFlows.length === 0) {
    return rows
      .slice()
      .sort((left, right) => left.ordem - right.ordem)
      .map((row, index) => ({
        occurrenceKey: `flow:default:step:${index + 1}:event:${row.eventKey}`,
        flowName: 'Fluxo Base',
        flowIndex: 0,
        stepIndex: index,
        stage: row.stage,
        eventKey: row.eventKey,
        eventTitle: row.eventTitle,
        actor: row.actor,
        service: row.service,
        tags: row.tags,
        queryHint: row.queryHint,
        sourceTouchPoint: row.sourceTouchPoint
      }));
  }

  const rowsByStage = new Map<string, EventStormingRow[]>();
  for (const row of rows) {
    const current = rowsByStage.get(row.stage) ?? [];
    current.push(row);
    rowsByStage.set(row.stage, current);
  }

  const occurrences: FlowOccurrence[] = [];

  recognizedFlows.forEach((flow, flowIndex) => {
    flow.stages.forEach((stage, stepIndex) => {
      const matchedRow = (rowsByStage.get(stage) ?? [])[0];
      if (!matchedRow) {
        return;
      }

      occurrences.push({
        occurrenceKey: `flow:${slugify(flow.name) || flowIndex + 1}:step:${stepIndex + 1}:event:${matchedRow.eventKey}`,
        flowName: flow.name,
        flowIndex,
        stepIndex,
        stage,
        eventKey: matchedRow.eventKey,
        eventTitle: matchedRow.eventTitle,
        actor: matchedRow.actor,
        service: matchedRow.service,
        tags: matchedRow.tags,
        queryHint: matchedRow.queryHint,
        sourceTouchPoint: matchedRow.sourceTouchPoint
      });
    });
  });

  return occurrences;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
