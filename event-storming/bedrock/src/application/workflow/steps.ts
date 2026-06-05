export const ORDERED_WORKFLOW_STEPS = [
  'prepare_image_ocr',
  'prepare_supporting_ocr',
  'classify_ocr_event_candidates',
  'detect_shape_geometry',
  'detect_arrow_geometry',
  'extract_flow_legends',
  'compose_spatial_observation',
  'compose_ocr_text_observations',
  'compose_observe_prompt_context',
  'compose_deterministic_image_observation',
  'validate_image_observation',
  'extract_events',
  'validate_candidate_events',
  'normalize_context',
  'validate_normalization',
  'create_workbook',
  'validate_workbook',
  'fail'
] as const;

export type WorkflowStepName = typeof ORDERED_WORKFLOW_STEPS[number];
export type WorkflowEndAt = Exclude<WorkflowStepName, 'fail'>;

export function shouldRequireState(endAt: WorkflowStepName, requiredAfter: WorkflowStepName): boolean {
  return workflowStepIndex(endAt) >= workflowStepIndex(requiredAfter);
}

export function workflowStepIndex(stepName: WorkflowStepName): number {
  const index = ORDERED_WORKFLOW_STEPS.indexOf(stepName);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}
