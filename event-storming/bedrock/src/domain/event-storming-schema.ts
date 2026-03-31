import { z } from 'zod';

export const AllowedWidgetSchema = z.enum(['event_stream', 'note', 'query_value', 'timeseries']);
export const ObservedEventRoleSchema = z.enum(['protagonist', 'supporting', 'unknown']);
export const ObservedColorSchema = z.enum(['#FF0000', '#305CDE', 'unknown']);
export const ObservedArrowStyleSchema = z.enum(['solid', 'dashed', 'unknown']);
export const ObservedFlowTypeSchema = z.enum(['main', 'alternate', 'unknown']);

export const EventVisualSemanticSchema = z.object({
  eventTitle: z.string().min(1),
  role: ObservedEventRoleSchema,
  colorHex: ObservedColorSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1)
});

export const TouchPointCorrelationSchema = z.object({
  touchPointTitle: z.string().min(1),
  eventsObservedAroundTouchPoint: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1)
});

export const ObservedFlowSchema = z.object({
  name: z.string().min(1),
  flowType: ObservedFlowTypeSchema,
  arrowStyle: ObservedArrowStyleSchema,
  orderedEventTitles: z.array(z.string().min(1)),
  touchPoints: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1)
});

export const ImageObservationSchema = z.object({
  touchPointsDetected: z.array(z.string()),
  textsOutsideShapes: z.array(z.string()),
  eventVisualSemantics: z.array(EventVisualSemanticSchema),
  touchPointEventCorrelations: z.array(TouchPointCorrelationSchema),
  flowsDetected: z.array(ObservedFlowSchema),
  actorsDetected: z.array(z.string()),
  servicesDetected: z.array(z.string()),
  uncertainItems: z.array(z.string()),
  assumptions: z.array(z.string())
});

export const CandidateFlowSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  orderedEventTitles: z.array(z.string().min(1)).min(1),
  stages: z.array(z.string().min(1)).min(1),
  actors: z.array(z.string()),
  services: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});

export const CandidateEventSchema = z.object({
  ordem: z.number().int().positive(),
  event_title: z.string().min(1),
  stage: z.string().min(1),
  actor: z.string(),
  service: z.string(),
  tags: z.string(),
  source_touch_point: z.string().optional()
});

export const CandidateContextSchema = z.object({
  candidateFlows: z.array(CandidateFlowSchema),
  candidateEvents: z.array(CandidateEventSchema).min(1),
  discardedItems: z.array(z.string()),
  assumptions: z.array(z.string())
});

export const NormalizationCorrectionSchema = z.object({
  ordem: z.number().int().positive(),
  keep: z.boolean(),
  event_title: z.string().min(1),
  stage: z.string().min(1),
  actor: z.string().min(1),
  service: z.string().min(1),
  tags: z.string().min(1)
});

export const NormalizationReviewSchema = z.object({
  correctedFlows: z.array(CandidateFlowSchema),
  corrections: z.array(NormalizationCorrectionSchema),
  assumptions: z.array(z.string())
});

export const RecognizedFlowSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  stages: z.array(z.string().min(1)).min(1),
  actors: z.array(z.string()),
  services: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});

export const RecognizedRowSchema = z.object({
  ordem: z.number().int().positive(),
  event_key: z.string().min(1),
  event_title: z.string().min(1),
  stage: z.string().min(1),
  actor: z.string().min(1),
  service: z.string().min(1),
  tags: z.string().min(1),
  dashboard_widget: AllowedWidgetSchema,
  query_hint: z.string().min(1),
  source_row: z.number().int().positive().nullable().optional(),
  source_touch_point: z.string().min(1).optional()
});

export const ConversionNoteSchema = z.object({
  item: z.string().min(1),
  detail: z.string().min(1)
});

export const RecognizedContextSchema = z.object({
  recognizedFlows: z.array(RecognizedFlowSchema),
  rows: z.array(RecognizedRowSchema).min(1),
  assumptions: z.array(z.string())
});

export const WorkbookSchema = z.object({
  sheetName: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(RecognizedRowSchema).min(1),
  notes: z.array(ConversionNoteSchema).default([])
});

export const REQUIRED_COLUMNS = [
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

export const PROJECT_FORMAT_COLUMNS = [
  ...REQUIRED_COLUMNS,
  'source_row',
  'source_touch_point'
] as const;

export type ImageObservation = z.infer<typeof ImageObservationSchema>;
export type CandidateContext = z.infer<typeof CandidateContextSchema>;
export type NormalizationReview = z.infer<typeof NormalizationReviewSchema>;
export type RecognizedContext = z.infer<typeof RecognizedContextSchema>;
export type WorkbookPayload = z.infer<typeof WorkbookSchema>;
export type WorkflowStage = 'observe' | 'extract' | 'normalize' | 'workbook';
