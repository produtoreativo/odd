import { z } from 'zod';

export const SupportedWidgetSchema = z.enum(['event_stream', 'note', 'query_value', 'timeseries']);
export const DashboardSectionTypeSchema = z.enum(['problems', 'normal']);
export const DashboardPaletteSchema = z.enum(['alert', 'warning', 'success', 'neutral']);

export const EventStormingRowSchema = z.object({
  ordem: z.number().int().positive(),
  eventKey: z.string().min(1),
  eventTitle: z.string().min(1),
  stage: z.string().min(1),
  actor: z.string().min(1),
  service: z.string().min(1),
  tags: z.array(z.string().min(1)),
  dashboardWidget: SupportedWidgetSchema,
  queryHint: z.string().min(1),
  sourceRow: z.number().int().positive().nullable().optional(),
  sourceTouchPoint: z.string().min(1).optional()
});

export const SloSuggestionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  objective: z.string().min(1),
  sliType: z.preprocess(
    (value) => normalizeSliType(value),
    z.enum(['availability', 'latency', 'error_rate', 'throughput'])
  ),
  target: z.string().min(1),
  rationale: z.string().min(1),
  sourceEventKeys: z.array(z.string().min(1)).min(1),
  sourceOccurrenceKeys: z.array(z.string().min(1)).min(1).optional(),
  queryHint: z.string().min(1)
});

export const DashboardWidgetPlanSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  widgetType: z.enum(['query_value', 'timeseries']),
  query: z.string().min(1),
  stage: z.string().min(1),
  sectionType: DashboardSectionTypeSchema,
  sourceEventKeys: z.array(z.string().min(1)).min(1),
  sourceOccurrenceKeys: z.array(z.string().min(1)).min(1).optional(),
  visualRole: z.string().min(1),
  palette: DashboardPaletteSchema,
  thresholdValue: z.number().optional(),
  thresholdDirection: z.enum(['above_bad', 'below_bad', 'at_least_good']).optional()
});

export const DashboardBandPlanSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sectionType: DashboardSectionTypeSchema,
  widgets: z.array(DashboardWidgetPlanSchema)
});

export const CustomEventPayloadSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  alert_type: z.enum(['error', 'warning', 'info', 'success']).optional(),
  priority: z.enum(['normal', 'low']).optional(),
  source_type_name: z.string().optional(),
  aggregation_key: z.string().optional()
});

export const DashboardPlanSchema = z.object({
  dashboardTitle: z.string().min(1),
  bands: z.array(DashboardBandPlanSchema).min(1),
  customEvents: z.array(CustomEventPayloadSchema),
  sloSuggestions: z.array(SloSuggestionSchema).min(3).max(5),
  assumptions: z.array(z.string())
});

export const CategorizedEventsSchema = z.object({
  problems: z.array(z.object({ eventKey: z.string().min(1) })),
  normal: z.array(z.object({ eventKey: z.string().min(1) }))
});

export type DashboardPlanContract = z.infer<typeof DashboardPlanSchema>;

function normalizeSliType(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'success_rate' || normalized === 'success-rate' || normalized === 'reliability') {
    return 'availability';
  }
  if (normalized === 'error-rate' || normalized === 'failure_rate' || normalized === 'failure-rate') {
    return 'error_rate';
  }
  if (normalized === 'traffic' || normalized === 'volume') {
    return 'throughput';
  }
  if (normalized === 'response_time' || normalized === 'response-time' || normalized === 'p95_latency') {
    return 'latency';
  }

  return normalized;
}
