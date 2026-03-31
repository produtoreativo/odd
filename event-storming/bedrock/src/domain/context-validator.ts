import {
  ImageObservation,
  CandidateContext,
  RecognizedContext,
  WorkbookPayload,
  WorkflowStage,
  PROJECT_FORMAT_COLUMNS
} from './event-storming-schema.js';
import { Logger } from '../shared/logger.js';
import { slugify, unique } from '../shared/text.js';

const logger = new Logger('context-validator');

export function validateImageObservation(observation: ImageObservation | null): string[] {
  logger.info('Validando observação da imagem', {
    hasObservation: Boolean(observation)
  });

  if (!observation) {
    return ['observe: observação ausente.'];
  }

  const issues: string[] = [];
  if (observation.touchPointsDetected.length === 0) {
    issues.push('touchPointsDetected não pode estar vazio.');
  }
  if (observation.textsOutsideShapes.length === 0) {
    issues.push('textsOutsideShapes não pode estar vazio.');
  }
  if (observation.touchPointEventCorrelations.length === 0) {
    issues.push('touchPointEventCorrelations não pode estar vazio.');
  }
  if (observation.eventVisualSemantics.length === 0) {
    issues.push('eventVisualSemantics não pode estar vazio.');
  }
  if (observation.flowsDetected.length === 0) {
    issues.push('flowsDetected não pode estar vazio.');
  }

  for (const correlation of observation.touchPointEventCorrelations) {
    if (!correlation.touchPointTitle.trim()) {
      issues.push('touchPointCorrelation sem touchPointTitle.');
    }
  }

  for (const semantic of observation.eventVisualSemantics) {
    if (!observation.textsOutsideShapes.includes(semantic.eventTitle)) {
      issues.push(`eventVisualSemantic fora de textsOutsideShapes: ${semantic.eventTitle}`);
    }
  }

  for (const flow of observation.flowsDetected) {
    if (flow.orderedEventTitles.length === 0) {
      issues.push(`flowDetected sem eventos: ${flow.name}`);
    }
    for (const eventTitle of flow.orderedEventTitles) {
      if (!observation.textsOutsideShapes.includes(eventTitle)) {
        issues.push(`flowDetected com evento fora de textsOutsideShapes: ${eventTitle}`);
      }
    }
  }

  const normalizedIssues = unique(issues);
  if (normalizedIssues.length > 0) {
    logger.warn('Falhas encontradas na validação da observação', {
      issues: normalizedIssues
    });
  }
  return normalizedIssues;
}

export function validateCandidateContext(candidateContext: CandidateContext | null): string[] {
  logger.info('Validando eventos candidatos', {
    hasCandidateContext: Boolean(candidateContext)
  });

  if (!candidateContext) {
    return ['extract: candidateContext ausente.'];
  }

  const issues: string[] = [];
  if (candidateContext.candidateEvents.length === 0) {
    issues.push('candidateEvents não pode estar vazio.');
  }

  const sortedOrders = candidateContext.candidateEvents
    .map((event) => event.ordem)
    .slice()
    .sort((a, b) => a - b);

  sortedOrders.forEach((value, index) => {
    if (value !== index + 1) {
      issues.push('candidateEvents.ordem deve ser sequencial iniciando em 1.');
    }
  });

  for (const event of candidateContext.candidateEvents) {
    if (!event.event_title.trim()) {
      issues.push('candidate event_title vazio.');
    }
    if (!event.stage.trim()) {
      issues.push(`candidate stage vazio para ordem ${event.ordem}.`);
    }
  }

  const normalizedIssues = unique(issues);
  if (normalizedIssues.length > 0) {
    logger.warn('Falhas encontradas na validação dos eventos candidatos', {
      issues: normalizedIssues
    });
  }
  return normalizedIssues;
}

export function validateRecognizedContext(
  context: RecognizedContext | null,
  stage: WorkflowStage
): string[] {
  logger.info('Validando contexto reconhecido', {
    stage,
    hasContext: Boolean(context)
  });

  if (!context) {
    return [`${stage}: contexto ausente.`];
  }

  const issues: string[] = [];
  const rowKeys = new Set<string>();
  const flowStages = new Set(context.recognizedFlows.flatMap((flow) => flow.stages));

  if (context.rows.length === 0) {
    issues.push('rows não pode estar vazio.');
  }

  const sortedOrders = context.rows.map((row) => row.ordem).slice().sort((a, b) => a - b);
  sortedOrders.forEach((value, index) => {
    if (value !== index + 1) {
      issues.push('ordem deve ser sequencial iniciando em 1.');
    }
  });

  for (const row of context.rows) {
    if (!/^[a-z0-9.]+$/.test(row.event_key)) {
      issues.push(`event_key inválido: ${row.event_key}`);
    }
    if (!/^[a-z0-9_]+$/.test(row.stage)) {
      issues.push(`stage inválido: ${row.stage}`);
    }
    if (!/^[a-z0-9.]+$/.test(row.service)) {
      issues.push(`service inválido: ${row.service}`);
    }
    if (row.stage === row.event_key) {
      issues.push(`stage não pode ser igual a event_key: ${row.event_key}`);
    }

    const expectedQueryHint = `tags:(event_key:${row.event_key} service:${row.service} source:odd)`;
    if (row.query_hint !== expectedQueryHint) {
      issues.push(`query_hint inválido para ${row.event_key}`);
    }

    const uniqueKey = `${row.ordem}:${row.event_key}`;
    if (rowKeys.has(uniqueKey)) {
      issues.push(`linha duplicada: ${uniqueKey}`);
    }
    rowKeys.add(uniqueKey);
  }

  for (const stageName of context.rows.map((row) => row.stage)) {
    if (!flowStages.has(stageName)) {
      issues.push(`stage sem fluxo correspondente: ${stageName}`);
    }
  }

  const normalizedIssues = unique(issues);
  logger.info('Resultado da validação do contexto', {
    stage,
    issueCount: normalizedIssues.length
  });
  if (normalizedIssues.length > 0) {
    logger.warn('Falhas encontradas na validação do contexto', {
      stage,
      issues: normalizedIssues
    });
  }

  return normalizedIssues;
}

export function validateWorkbook(workbook: WorkbookPayload | null): string[] {
  logger.info('Validando payload de workbook', {
    hasWorkbook: Boolean(workbook)
  });

  if (!workbook) {
    return ['workbook ausente.'];
  }

  const issues: string[] = [];
  if (workbook.sheetName !== 'project_input') {
    issues.push('sheetName deve ser project_input.');
  }

  if (JSON.stringify(workbook.columns) !== JSON.stringify(PROJECT_FORMAT_COLUMNS)) {
    issues.push('columns não corresponde ao layout obrigatório.');
  }

  for (const row of workbook.rows) {
    if (typeof row.tags !== 'string' || row.tags.trim() === '') {
      issues.push(`tags inválido para ${row.event_key}`);
    }
    if (!row.source_touch_point || row.source_touch_point.trim() === '') {
      issues.push(`source_touch_point inválido para ${row.event_key}`);
    }
  }

  const normalizedIssues = unique(issues);
  logger.info('Resultado da validação do workbook', {
    issueCount: normalizedIssues.length
  });
  if (normalizedIssues.length > 0) {
    logger.warn('Falhas encontradas na validação do workbook', {
      issues: normalizedIssues
    });
  }

  return normalizedIssues;
}
