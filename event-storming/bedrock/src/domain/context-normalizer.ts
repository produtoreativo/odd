import path from 'node:path';
import {
  CandidateContext,
  ImageObservation,
  NormalizationReview,
  RecognizedContext
} from './event-storming-schema.js';
import { Logger } from '../shared/logger.js';
import { slugify, unique } from '../shared/text.js';

const logger = new Logger('context-normalizer');

type NormalizationOptions = {
  inputImage?: string;
};

type ProjectMetadata = {
  businessDomain: string;
  sourceSheet: string;
};

type EventMetadata = {
  sourceTouchPoint: string;
  domain: string;
  subdomain: string;
  stage: string;
  service: string;
  actor: string;
  metricType: 'count' | 'gauge';
  tags: string;
  eventKeyBase: string;
};

export function candidateContextToRecognizedContext(
  candidateContext: CandidateContext,
  options: NormalizationOptions = {}
): RecognizedContext {
  const normalizedCandidateContext = normalizeCandidateContextDomainModels(candidateContext, options);
  logger.info('Convertendo eventos candidatos em contexto reconhecido', {
    candidateEventCount: normalizedCandidateContext.candidateEvents.length,
    candidateFlowCount: normalizedCandidateContext.candidateFlows.length
  });

  const projectMetadata = deriveProjectMetadata(normalizedCandidateContext, options);
  const eventMetadataByTitle = buildEventMetadataByTitle(normalizedCandidateContext, projectMetadata);
  const normalizedFlowStages = unique(
    normalizedCandidateContext.candidateEvents.map((event) => eventMetadataByTitle.get(event.event_title)?.stage || slugify(event.stage))
  );

  return canonicalizeContext({
    recognizedFlows: normalizedCandidateContext.candidateFlows.map((flow) => ({
      name: flow.name,
      description: flow.description.trim() || `Fluxo derivado de ${flow.name}.`,
      stages: flow.stages.length > 0 ? flow.stages : normalizedFlowStages,
      actors: flow.actors.length > 0 ? flow.actors : ['system'],
      services: flow.services.length > 0 ? flow.services : unique(
        flow.orderedEventTitles
          .map((eventTitle) => eventMetadataByTitle.get(eventTitle)?.service)
          .filter((service): service is string => Boolean(service))
      ),
      confidence: flow.confidence
    })),
    rows: normalizedCandidateContext.candidateEvents.map((event) => {
      const metadata = eventMetadataByTitle.get(event.event_title)
        || buildEventMetadata(event, normalizedCandidateContext, projectMetadata);

      return {
        ordem: event.ordem,
        event_key: metadata.eventKeyBase,
        event_title: event.event_title,
        stage: metadata.stage,
        actor: metadata.actor,
        service: metadata.service,
        tags: metadata.tags,
        dashboard_widget: 'event_stream',
        query_hint: '',
        source_row: null,
        source_touch_point: metadata.sourceTouchPoint
      };
    }),
    assumptions: normalizedCandidateContext.assumptions
  });
}

export function applyNormalizationReview(
  candidateContext: CandidateContext,
  review: NormalizationReview | null,
  options: NormalizationOptions = {}
): RecognizedContext {
  if (!review) {
    logger.warn('Nenhuma revisão fornecida; usando contexto determinístico derivado dos candidatos');
    return candidateContextToRecognizedContext(candidateContext, options);
  }

  logger.info('Aplicando revisão de normalização', {
    correctionCount: review.corrections.length,
    correctedFlowCount: review.correctedFlows.length
  });

  const correctionsByOrder = new Map(review.corrections.map((correction) => [correction.ordem, correction]));
  const sourceTouchPointByOrder = new Map(
    candidateContext.candidateEvents.map((event) => [event.ordem, event.source_touch_point || ''])
  );

  const reviewedCandidateContext: CandidateContext = {
    candidateFlows: review.correctedFlows.length > 0
      ? review.correctedFlows
      : candidateContext.candidateFlows,
    candidateEvents: candidateContext.candidateEvents
      .map((event) => {
        const correction = correctionsByOrder.get(event.ordem);
        if (!correction) {
          return event;
        }
        if (!correction.keep) {
          return null;
        }
        return {
          ordem: event.ordem,
          event_title: correction.event_title.trim() || event.event_title,
          stage: correction.stage.trim() || event.stage,
          actor: correction.actor.trim() || event.actor,
          service: correction.service.trim() || event.service,
          tags: correction.tags.trim() || event.tags,
          source_touch_point: sourceTouchPointByOrder.get(event.ordem) || event.source_touch_point
        };
      })
      .filter((event): event is CandidateContext['candidateEvents'][number] => event !== null),
    discardedItems: candidateContext.discardedItems,
    assumptions: unique([...candidateContext.assumptions, ...review.assumptions])
  };

  return candidateContextToRecognizedContext(reviewedCandidateContext, options);
}

export function imageObservationToCandidateContext(
  observation: ImageObservation,
  options: NormalizationOptions = {}
): CandidateContext {
  logger.info('Convertendo observação da imagem em candidatos determinísticos', {
    touchPointCount: observation.touchPointsDetected.length,
    correlationCount: observation.touchPointEventCorrelations.length,
    detectedFlowCount: observation.flowsDetected.length
  });

  const observedEvents = unique(observation.textsOutsideShapes.map((item) => item.trim()).filter(Boolean));
  const validTouchPoints = unique(observation.touchPointsDetected.map((item) => item.trim()).filter(Boolean));
  const sanitizedCorrelations = observation.touchPointEventCorrelations
    .map((correlation) => ({
      ...correlation,
      touchPointTitle: correlation.touchPointTitle.trim(),
      eventsObservedAroundTouchPoint: unique(
        correlation.eventsObservedAroundTouchPoint
          .map((item) => item.trim())
          .filter((item) => item !== '' && observedEvents.includes(item))
      )
    }))
    .filter((correlation) => correlation.touchPointTitle !== '');
  const observedFlows = observation.flowsDetected
    .map((flow) => ({
      ...flow,
      name: flow.name.trim(),
      orderedEventTitles: unique(
        flow.orderedEventTitles
          .map((item) => item.trim())
          .filter((item) => item !== '' && observedEvents.includes(item))
      ),
      touchPoints: unique(
        flow.touchPoints
          .map((item) => item.trim())
          .filter((item) => item !== '' && validTouchPoints.includes(item))
      )
    }))
    .filter((flow) => flow.name !== '' && flow.orderedEventTitles.length > 0);
  const eventOrder = buildObservedEventOrder(observedEvents, observedFlows);
  const eventVisualSemanticsByTitle = new Map(
    observation.eventVisualSemantics.map((semantic) => [semantic.eventTitle.trim(), semantic])
  );
  const strongestTouchPointByEvent = buildStrongestTouchPointByEvent(
    observedEvents,
    sanitizedCorrelations,
    observedFlows
  );
  const projectMetadata = deriveProjectMetadataFromObservation(observation, options);

  const flattenedEvents = eventOrder.map((eventTitle) => {
    const touchPoint = strongestTouchPointByEvent.get(eventTitle)
      || inferStageFromEventTitle(eventTitle, validTouchPoints)
      || validTouchPoints[0]
      || 'event_storming';
    const metadata = buildProjectMetadataFromTouchPoint(
      eventTitle,
      touchPoint,
      projectMetadata.businessDomain
    );
    const semantic = eventVisualSemanticsByTitle.get(eventTitle);

    return {
      event_title: eventTitle,
      stage: metadata.stage,
      actor: inferActor(observation.actorsDetected),
      service: metadata.service,
      tags: buildTags({
        touchPoint,
        businessDomain: projectMetadata.businessDomain,
        domain: metadata.domain,
        subdomain: metadata.subdomain,
        metricType: inferMetricType(eventTitle, semantic?.role),
        sourceSheet: projectMetadata.sourceSheet
      }),
      source_touch_point: touchPoint
    };
  });

  const uniqueEvents = uniqueBy(
    flattenedEvents.filter((event) => event.event_title !== ''),
    (event) => event.event_title
  ).map((event, index) => ({
    ordem: index + 1,
    ...event
  }));

  const candidateFlows = observedFlows.length > 0
    ? observedFlows.map((flow) => ({
        name: buildCandidateFlowName(flow.name, flow.flowType),
        description: buildCandidateFlowDescription(flow.flowType, flow.arrowStyle, flow.reasoning),
        orderedEventTitles: flow.orderedEventTitles,
        stages: inferStagesFromOrderedEvents(flow.orderedEventTitles, flattenedEvents, flow.touchPoints),
        actors: [inferActor(observation.actorsDetected)],
        services: unique(
          flow.orderedEventTitles
            .map((eventTitle) => flattenedEvents.find((event) => event.event_title === eventTitle)?.service || '')
            .filter(Boolean)
        ),
        confidence: flow.confidence
      }))
    : sanitizedCorrelations
        .filter((correlation) => correlation.eventsObservedAroundTouchPoint.length > 0)
        .map((correlation) => ({
          name: correlation.touchPointTitle.trim(),
          description: correlation.reasoning.trim() || `Fluxo associado a ${correlation.touchPointTitle}.`,
          orderedEventTitles: unique(correlation.eventsObservedAroundTouchPoint.map((item) => item.trim()).filter(Boolean)),
          stages: unique(
            unique(correlation.eventsObservedAroundTouchPoint.map((item) => item.trim()).filter(Boolean))
              .map((eventTitle) => {
                const flattenedEvent = flattenedEvents.find((event) => event.event_title === eventTitle);
                return flattenedEvent?.stage || deriveDomainModelStage(eventTitle, correlation.touchPointTitle.trim());
              })
          ),
          actors: [inferActor(observation.actorsDetected)],
          services: unique(
            unique(correlation.eventsObservedAroundTouchPoint.map((item) => item.trim()).filter(Boolean))
              .map((eventTitle) => flattenedEvents.find((event) => event.event_title === eventTitle)?.service || '')
              .filter(Boolean)
          ),
          confidence: correlation.confidence
        }));

  return normalizeCandidateContextDomainModels({
    candidateFlows: candidateFlows.length > 0
      ? candidateFlows
      : [
          {
            name: 'fluxo_reconhecido',
            description: 'Fluxo derivado deterministicamente da observação da imagem.',
            orderedEventTitles: uniqueEvents.map((event) => event.event_title),
            stages: unique(uniqueEvents.map((event) => event.stage)),
            actors: [inferActor(observation.actorsDetected)],
            services: unique(uniqueEvents.map((event) => event.service)),
            confidence: 0.5
          }
        ],
    candidateEvents: uniqueEvents,
    discardedItems: observation.uncertainItems,
    assumptions: observation.assumptions
  }, options);
}

export function normalizeCandidateContextDomainModels(
  candidateContext: CandidateContext,
  options: NormalizationOptions = {}
): CandidateContext {
  logger.info('Normalizando candidateContext para stages por domain model', {
    candidateEventCount: candidateContext.candidateEvents.length,
    candidateFlowCount: candidateContext.candidateFlows.length
  });

  const projectMetadata = deriveProjectMetadata(candidateContext, options);
  const normalizedEvents = candidateContext.candidateEvents.map((event) => {
    const metadata = buildEventMetadata(event, candidateContext, projectMetadata);
    return {
      ...event,
      stage: metadata.stage,
      actor: metadata.actor,
      service: metadata.service,
      tags: metadata.tags,
      source_touch_point: metadata.sourceTouchPoint
    };
  });
  const normalizedEventByTitle = new Map(normalizedEvents.map((event) => [event.event_title, event]));

  return {
    ...candidateContext,
    candidateFlows: candidateContext.candidateFlows.map((flow) => ({
      ...flow,
      stages: unique(
        flow.orderedEventTitles
          .map((eventTitle) => normalizedEventByTitle.get(eventTitle)?.stage || deriveDomainModelStage(eventTitle, flow.name))
          .filter(Boolean)
      ),
      actors: flow.actors.length > 0 ? unique(flow.actors.map(normalizeActor).filter(Boolean)) : ['system'],
      services: flow.services.length > 0
        ? unique(flow.services.map((service) => slugify(service).replace(/_/g, '.')).filter(Boolean))
        : unique(
            flow.orderedEventTitles
              .map((eventTitle) => normalizedEventByTitle.get(eventTitle)?.service || '')
              .filter(Boolean)
          )
    })),
    candidateEvents: normalizedEvents
  };
}

export function enrichCandidateContextFromObservation(
  candidateContext: CandidateContext,
  observation: ImageObservation,
  options: NormalizationOptions = {}
): CandidateContext {
  const deterministicContext = imageObservationToCandidateContext(observation, options);
  const deterministicEventByTitle = new Map(
    deterministicContext.candidateEvents.map((event) => [event.event_title, event])
  );
  const deterministicFlowBySignature = new Map(
    deterministicContext.candidateFlows.map((flow) => [flow.orderedEventTitles.join('||'), flow])
  );

  return normalizeCandidateContextDomainModels({
    ...candidateContext,
    candidateFlows: candidateContext.candidateFlows.map((flow) => {
      const deterministicFlow = deterministicFlowBySignature.get(flow.orderedEventTitles.join('||'));
      return {
        ...flow,
        stages: flow.stages.length > 0 ? flow.stages : deterministicFlow?.stages || [],
        actors: flow.actors.length > 0 ? flow.actors : deterministicFlow?.actors || [],
        services: flow.services.length > 0 ? flow.services : deterministicFlow?.services || []
      };
    }),
    candidateEvents: candidateContext.candidateEvents.map((event) => {
      const deterministicEvent = deterministicEventByTitle.get(event.event_title);
      return {
        ...event,
        stage: event.stage || deterministicEvent?.stage || event.stage,
        actor: event.actor || deterministicEvent?.actor || event.actor,
        service: event.service || deterministicEvent?.service || event.service,
        tags: event.tags || deterministicEvent?.tags || event.tags,
        source_touch_point: event.source_touch_point || deterministicEvent?.source_touch_point
      };
    })
  }, options);
}

function buildObservedEventOrder(observedEvents: string[], flows: ImageObservation['flowsDetected']): string[] {
  const orderedFromFlows = unique(flows.flatMap((flow) => flow.orderedEventTitles));
  const remainingEvents = observedEvents.filter((eventTitle) => !orderedFromFlows.includes(eventTitle));
  return [...orderedFromFlows, ...remainingEvents];
}

function inferStagesFromOrderedEvents(
  orderedEventTitles: string[],
  flattenedEvents: Array<{ event_title: string; stage: string }>,
  touchPoints: string[]
): string[] {
  const stageByEventTitle = new Map(flattenedEvents.map((event) => [event.event_title, event.stage]));
  const inferredStages = unique(
    orderedEventTitles
      .map((eventTitle) => stageByEventTitle.get(eventTitle))
      .filter((stage): stage is string => Boolean(stage))
  );

  if (inferredStages.length > 0) {
    return inferredStages;
  }

  return unique(
    touchPoints.map((touchPoint) => buildProjectMetadataFromTouchPoint(touchPoint, touchPoint, 'event_storming').stage)
  );
}

function buildCandidateFlowName(name: string, flowType: ImageObservation['flowsDetected'][number]['flowType']): string {
  if (flowType === 'main') {
    return `${name} principal`;
  }
  if (flowType === 'alternate') {
    return `${name} alternativo`;
  }
  return name;
}

function buildCandidateFlowDescription(
  flowType: ImageObservation['flowsDetected'][number]['flowType'],
  arrowStyle: ImageObservation['flowsDetected'][number]['arrowStyle'],
  reasoning: string
): string {
  const flowTypeDescription = flowType === 'main'
    ? 'Fluxo principal identificado por setas sólidas.'
    : flowType === 'alternate'
      ? 'Fluxo alternativo identificado por setas tracejadas.'
      : 'Fluxo identificado visualmente na imagem.';
  const arrowDescription = arrowStyle === 'solid'
    ? 'Setas sólidas observadas.'
    : arrowStyle === 'dashed'
      ? 'Setas tracejadas observadas.'
      : 'Estilo de seta inconclusivo.';
  const normalizedReasoning = reasoning.trim();

  return normalizedReasoning === ''
    ? `${flowTypeDescription} ${arrowDescription}`
    : `${flowTypeDescription} ${arrowDescription} ${normalizedReasoning}`;
}

function deriveDomainModelStage(eventTitle: string, contextualStage: string): string {
  const eventTokens = tokenize(eventTitle).filter((token) => !EVENT_NON_DOMAIN_TOKENS.has(token));
  const contextualTokens = tokenize(contextualStage).filter((token) => !CONTEXT_NON_DOMAIN_TOKENS.has(token));
  const explicitStage = inferExplicitDomainStage(eventTokens) || inferExplicitDomainStage(contextualTokens);
  if (explicitStage) {
    return explicitStage;
  }
  const preferredTokens = eventTokens.length > 0 ? eventTokens : contextualTokens;

  if (preferredTokens.length === 0) {
    return slugify(contextualStage);
  }

  const canonicalTokens = preferredTokens.map(singularizeToken).filter(Boolean);
  const stage = canonicalTokens.slice(0, 2).join('_');
  return stage === '' ? slugify(contextualStage) : stage;
}

function inferExplicitDomainStage(tokens: string[]): string | undefined {
  for (const domainToken of DOMAIN_STAGE_PRIORITY) {
    if (tokens.includes(domainToken)) {
      return domainToken;
    }
  }

  return undefined;
}

function singularizeToken(token: string): string {
  if (token.endsWith('oes')) {
    return `${token.slice(0, -3)}ao`;
  }
  if (token.endsWith('aes')) {
    return `${token.slice(0, -3)}ao`;
  }
  if (token.endsWith('is') && token.length > 4) {
    return `${token.slice(0, -2)}l`;
  }
  if (token.endsWith('s') && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

const EVENT_NON_DOMAIN_TOKENS = new Set([
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
  'em',
  'no',
  'na',
  'para',
  'com',
  'por',
  'via',
  'salva',
  'salvo',
  'salvos',
  'salvas',
  'intencao',
  'encontrado',
  'encontrada',
  'encontrados',
  'encontradas',
  'nao',
  'cadastrado',
  'cadastrada',
  'cadastrados',
  'cadastradas',
  'pendente',
  'pendentes',
  'criada',
  'criado',
  'criadas',
  'criados'
]);

const DOMAIN_STAGE_PRIORITY = [
  'cliente',
  'pagamento',
  'fatura',
  'cobranca'
];

const CONTEXT_NON_DOMAIN_TOKENS = new Set([
  'via',
  'checkout',
  'cadastro',
  'processamento',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e',
  'em',
  'no',
  'na',
  'para',
  'com',
  'por'
]);

function inferStageFromEventTitle(eventTitle: string, touchPoints: string[]): string | undefined {
  const eventTokens = tokenize(eventTitle);

  let bestMatch: { touchPoint: string; score: number } | undefined;
  for (const touchPoint of touchPoints) {
    const touchPointTokens = tokenize(touchPoint);
    const score = overlapScore(eventTokens, touchPointTokens);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { touchPoint, score };
    }
  }

  return bestMatch && bestMatch.score > 0 ? bestMatch.touchPoint : undefined;
}

function tokenize(value: string): string[] {
  return slugify(value)
    .split('_')
    .filter(Boolean);
}

function overlapScore(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token)).length;
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

export function canonicalizeContext(context: RecognizedContext): RecognizedContext {
  logger.info('Normalizando contexto reconhecido', {
    rowCount: context.rows.length,
    flowCount: context.recognizedFlows.length
  });

  const eventKeyUsage = new Map<string, number>();
  const rows = context.rows
    .slice()
    .sort((left, right) => left.ordem - right.ordem)
    .map((row, index) => {
      const rawEventKey = normalizeEventKey(row.event_key);
      const eventKey = ensureUniqueEventKey(rawEventKey, eventKeyUsage);
      const stage = slugify(row.stage);
      const service = normalizeService(row.service);

      logger.debug('Normalizando linha', {
        originalOrder: row.ordem,
        normalizedOrder: index + 1,
        eventKey,
        stage,
        service
      });

      return {
        ordem: index + 1,
        event_key: eventKey,
        event_title: row.event_title.trim(),
        stage,
        actor: normalizeActor(row.actor),
        service,
        tags: normalizeTags(row.tags),
        dashboard_widget: row.dashboard_widget,
        query_hint: `tags:(event_key:${eventKey} service:${service} source:odd)`,
        source_row: row.source_row ?? null,
        source_touch_point: row.source_touch_point?.trim() || undefined
      };
    });

  const stages = unique(rows.map((row) => row.stage));
  const services = unique(rows.map((row) => row.service));
  const actors = unique(rows.map((row) => row.actor));

  const recognizedFlows = context.recognizedFlows.length > 0
    ? context.recognizedFlows.map((flow) => ({
        ...flow,
        stages: unique(flow.stages.map(slugify)).filter((stage) => stages.includes(stage)),
        services: unique(flow.services.map(normalizeService)).filter((service) => services.includes(service)),
        actors: unique(flow.actors.map(normalizeActor)).filter((actor) => actors.includes(actor))
      }))
    : [
        {
          name: 'project_input',
          description: 'Fluxo consolidado automaticamente a partir dos eventos reconhecidos.',
          stages,
          services,
          actors,
          confidence: 0.5
        }
      ];

  return {
    recognizedFlows,
    rows,
    assumptions: unique(context.assumptions.map((assumption) => assumption.trim()).filter(Boolean))
  };
}

function buildStrongestTouchPointByEvent(
  observedEvents: string[],
  correlations: ImageObservation['touchPointEventCorrelations'],
  flows: ImageObservation['flowsDetected']
): Map<string, string> {
  const best = new Map<string, { touchPoint: string; score: number }>();

  for (const correlation of correlations) {
    for (const eventTitle of correlation.eventsObservedAroundTouchPoint) {
      const candidate = best.get(eventTitle);
      if (!candidate || correlation.confidence > candidate.score) {
        best.set(eventTitle, {
          touchPoint: correlation.touchPointTitle,
          score: correlation.confidence
        });
      }
    }
  }

  for (const flow of flows) {
    for (let index = 0; index < flow.orderedEventTitles.length; index += 1) {
      const eventTitle = flow.orderedEventTitles[index];
      const touchPoint = flow.touchPoints[Math.min(index, flow.touchPoints.length - 1)];
      if (!touchPoint) {
        continue;
      }
      const candidate = best.get(eventTitle);
      const score = flow.confidence - (index * 0.01);
      if (!candidate || score > candidate.score) {
        best.set(eventTitle, { touchPoint, score });
      }
    }
  }

  for (const eventTitle of observedEvents) {
    if (!best.has(eventTitle)) {
      best.set(eventTitle, { touchPoint: 'event_storming', score: 0 });
    }
  }

  return new Map([...best.entries()].map(([eventTitle, value]) => [eventTitle, value.touchPoint]));
}

function deriveProjectMetadata(candidateContext: CandidateContext, options: NormalizationOptions): ProjectMetadata {
  const sourceSheet = deriveSourceSheet(options.inputImage);
  const businessDomain = inferBusinessDomain([
    ...candidateContext.candidateEvents.flatMap((event) => [
      event.event_title,
      event.stage,
      event.service,
      event.source_touch_point || ''
    ]),
    ...candidateContext.candidateFlows.flatMap((flow) => [flow.name, ...flow.stages, ...flow.services])
  ], sourceSheet);

  return { businessDomain, sourceSheet };
}

function deriveProjectMetadataFromObservation(
  observation: ImageObservation,
  options: NormalizationOptions
): ProjectMetadata {
  const sourceSheet = deriveSourceSheet(options.inputImage);
  const businessDomain = inferBusinessDomain([
    ...observation.touchPointsDetected,
    ...observation.textsOutsideShapes,
    ...observation.servicesDetected
  ], sourceSheet);

  return { businessDomain, sourceSheet };
}

function deriveSourceSheet(inputImage?: string): string {
  if (!inputImage) {
    return 'event_storming_image';
  }

  return slugify(path.basename(inputImage, path.extname(inputImage))) || 'event_storming_image';
}

function inferBusinessDomain(values: string[], sourceSheet: string): string {
  const tokens = values.flatMap(tokenize);
  if (tokens.some((token) => ['pagamento', 'cobranca', 'checkout', 'fatura', 'psp', 'payment'].includes(token))) {
    return 'payments';
  }
  if (tokens.some((token) => ['cliente', 'customer', 'cadastro'].includes(token))) {
    return 'customer';
  }
  return sourceSheet.replace(/^odd_/, '') || 'event_storming';
}

function buildEventMetadataByTitle(
  candidateContext: CandidateContext,
  projectMetadata: ProjectMetadata
): Map<string, EventMetadata> {
  return new Map(
    candidateContext.candidateEvents.map((event) => [
      event.event_title,
      buildEventMetadata(event, candidateContext, projectMetadata)
    ])
  );
}

function buildEventMetadata(
  event: CandidateContext['candidateEvents'][number],
  candidateContext: CandidateContext,
  projectMetadata: ProjectMetadata
): EventMetadata {
  const sourceTouchPoint = event.source_touch_point?.trim()
    || inferTouchPointFromCandidateContext(event.event_title, candidateContext)
    || event.stage
    || 'event_storming';
  const touchPointMetadata = buildProjectMetadataFromTouchPoint(
    event.event_title,
    sourceTouchPoint,
    projectMetadata.businessDomain
  );

  return {
    sourceTouchPoint,
    domain: touchPointMetadata.domain,
    subdomain: touchPointMetadata.subdomain,
    stage: touchPointMetadata.stage,
    service: touchPointMetadata.service,
    actor: normalizeActor(event.actor),
    metricType: inferMetricType(event.event_title),
    tags: buildTags({
      touchPoint: sourceTouchPoint,
      businessDomain: projectMetadata.businessDomain,
      domain: touchPointMetadata.domain,
      subdomain: touchPointMetadata.subdomain,
      metricType: inferMetricType(event.event_title),
      sourceSheet: projectMetadata.sourceSheet
    }),
    eventKeyBase: buildEventKeyBase(projectMetadata.businessDomain, touchPointMetadata.service, event.event_title)
  };
}

function inferTouchPointFromCandidateContext(eventTitle: string, candidateContext: CandidateContext): string | undefined {
  for (const flow of candidateContext.candidateFlows) {
    if (flow.orderedEventTitles.includes(eventTitle)) {
      const matchingEvent = candidateContext.candidateEvents.find((event) => event.event_title === eventTitle);
      if (matchingEvent?.source_touch_point) {
        return matchingEvent.source_touch_point;
      }
      const stage = flow.stages.find(Boolean);
      if (stage) {
        return stage;
      }
    }
  }

  return candidateContext.candidateEvents.find((event) => event.event_title === eventTitle)?.source_touch_point;
}

function buildProjectMetadataFromTouchPoint(
  eventTitle: string,
  sourceTouchPoint: string,
  businessDomain: string
): Pick<EventMetadata, 'domain' | 'subdomain' | 'stage' | 'service' | 'eventKeyBase'> {
  const touchPointTokens = tokenize(sourceTouchPoint).filter((token) => !TOUCH_POINT_NON_DOMAIN_TOKENS.has(token));
  const eventStage = deriveDomainModelStage(eventTitle, sourceTouchPoint);
  const domain = inferExplicitDomainStage(touchPointTokens)
    || inferExplicitDomainStage(tokenize(eventTitle))
    || touchPointTokens[0]
    || eventStage
    || 'event_storming';
  const subdomain = touchPointTokens.find((token) => token !== domain)
    || secondStageToken(eventStage)
    || domain;
  const stage = unique([domain, subdomain]).join('_');
  const service = unique([domain, subdomain]).join('.');

  return {
    domain,
    subdomain,
    stage,
    service,
    eventKeyBase: buildEventKeyBase(businessDomain, service, eventTitle)
  };
}

function secondStageToken(stage: string): string | undefined {
  const tokens = tokenize(stage);
  return tokens.length > 1 ? tokens[1] : undefined;
}

function buildTags(args: {
  touchPoint: string;
  businessDomain: string;
  domain: string;
  subdomain: string;
  metricType: 'count' | 'gauge';
  sourceSheet: string;
}): string {
  return [
    `touch_point:${slugify(args.touchPoint)}`,
    `business_domain:${args.businessDomain}`,
    `domain:${args.domain}`,
    `subdomain:${args.subdomain}`,
    `metric_type:${args.metricType}`,
    `source_sheet:${args.sourceSheet}`
  ].join(',');
}

function buildEventKeyBase(businessDomain: string, service: string, eventTitle: string): string {
  const action = deriveEventAction(eventTitle);
  return normalizeEventKey(`${businessDomain}.${service}.${action}`);
}

function deriveEventAction(eventTitle: string): string {
  const normalizedTitle = slugify(eventTitle);

  if (/(nao|falha|erro|ausente|invalido|rejeitado)/.test(normalizedTitle)) {
    return `${normalizedTitle}.failure`;
  }
  if (/(criada|criado|cadastrado|cadastrada|salva|salvo)/.test(normalizedTitle)) {
    return normalizedTitle;
  }
  if (/(encontrado|encontrada)/.test(normalizedTitle)) {
    return `${normalizedTitle}.view`;
  }

  return normalizedTitle;
}

function inferActor(actors: string[]): string {
  if (actors.some((actor) => /integration|system|sor/i.test(actor))) {
    return 'system';
  }
  return normalizeActor(actors[0] || 'system');
}

function normalizeActor(actor: string): string {
  const normalized = slugify(actor).replace(/_/g, '.');
  if (normalized === '' || /integration|sor|system|sistema/.test(normalized)) {
    return 'system';
  }
  return normalized;
}

function normalizeService(service: string): string {
  const normalized = slugify(service).replace(/_/g, '.');
  return normalized === '' ? 'event.storming' : normalized;
}

function normalizeTags(tags: string): string {
  const seen = new Set<string>();
  const normalized = tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => {
      if (seen.has(tag)) {
        return false;
      }
      seen.add(tag);
      return true;
    });

  return normalized.join(',');
}

function normalizeEventKey(eventKey: string): string {
  return eventKey
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.|\.$/g, '');
}

function ensureUniqueEventKey(eventKey: string, usage: Map<string, number>): string {
  const count = (usage.get(eventKey) || 0) + 1;
  usage.set(eventKey, count);
  if (count === 1) {
    return eventKey;
  }
  return `${eventKey}.dup${count}`;
}

function inferMetricType(eventTitle: string, role?: string): 'count' | 'gauge' {
  const normalizedTitle = slugify(eventTitle);
  if (/(nao|falha|erro|ausente|pendente|rejeitado)/.test(normalizedTitle)) {
    return 'count';
  }
  if (role === 'supporting') {
    return 'count';
  }
  return 'gauge';
}

const TOUCH_POINT_NON_DOMAIN_TOKENS = new Set([
  'via',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'e'
]);
