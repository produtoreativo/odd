import { z } from 'zod';

/**
 * Subconjunto do image-observation.json (saída do passo 1, event-storming/bedrock)
 * que este workflow consome como entrada. Mantemos passthrough para não acoplar a
 * todos os campos da observação, validando apenas o que o passo 2 precisa.
 */
export const CommandDetectedInputSchema = z.object({
  touchPointTitle: z.string().min(1),
  commandName: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional()
});

export const TouchPointCorrelationInputSchema = z.object({
  touchPointTitle: z.string().min(1),
  eventsObservedAroundTouchPoint: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional()
});

export const ObservationInputSchema = z
  .object({
    touchPointsDetected: z.array(z.string()).default([]),
    commandsDetected: z.array(CommandDetectedInputSchema).default([]),
    touchPointEventCorrelations: z.array(TouchPointCorrelationInputSchema).default([]),
    actorsDetected: z.array(z.string()).default([]),
    servicesDetected: z.array(z.string()).default([])
  })
  .passthrough();

/**
 * Saída do passo 2 — "Identificar os requisitos do contrato".
 *
 * Cada campo carrega `provenance` para separar o que o Event Storming sustenta
 * (`observed`) do que o modelo apenas inferiu (`inferred`). O passo 3
 * ("complementar com o mínimo exigido") usa `uncertainItems` e os campos
 * `inferred` para fechar lacunas; este passo NÃO inventa campos sem lastro.
 */
export const ProvenanceSchema = z.enum(['observed', 'inferred']);

export const ContractFieldSchema = z.object({
  name: z.string().min(1),
  inferredType: z.enum(['string', 'number', 'integer', 'boolean', 'object', 'array', 'unknown']),
  required: z.boolean(),
  provenance: ProvenanceSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1)
});

export const ContractOutcomeSchema = z.object({
  eventTitle: z.string().min(1),
  kind: z.enum(['success', 'failure']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1)
});

export const ContractRequirementSchema = z.object({
  commandName: z.string().min(1),
  touchPointTitle: z.string().min(1),
  triggeringActor: z.string().min(1),
  targetService: z.string().min(1),
  inputFields: z.array(ContractFieldSchema).default([]),
  minimalIdentifiers: z.array(z.string().min(1)).default([]),
  successOutcomes: z.array(ContractOutcomeSchema).default([]),
  failureOutcomes: z.array(ContractOutcomeSchema).default([]),
  preconditions: z.array(z.string().min(1)).default([]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  uncertainItems: z.array(z.string()).default([])
});

export const ContractRequirementsSchema = z.object({
  contracts: z.array(ContractRequirementSchema).min(1),
  assumptions: z.array(z.string()).default([]),
  uncertainItems: z.array(z.string()).default([])
});

export type ObservationInput = z.infer<typeof ObservationInputSchema>;
export type ContractRequirement = z.infer<typeof ContractRequirementSchema>;
export type ContractRequirements = z.infer<typeof ContractRequirementsSchema>;
export type ContractWorkflowStage = 'identify';
