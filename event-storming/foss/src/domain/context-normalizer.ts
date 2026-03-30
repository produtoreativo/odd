import {
  CandidateContext,
  ImageObservation,
  NormalizationReview,
  RecognizedContext
} from './event-storming-schema.js';
import { Logger } from '../shared/logger.js';
import { slugify, unique } from '../shared/text.js';

const logger = new Logger('context-normalizer');

export function candidateContextToRecognizedContext(candidateContext: CandidateContext): RecognizedContext {
  const normalizedCandidateContext = normalizeCandidateContextDomainModels(candidateContext);
  logger.info('Convertendo eventos candidatos em contexto reconhecido', {
    candidateEventCount: normalizedCandidateContext.candidateEvents.length,
    candidateFlowCount: normalizedCandidateContext.candidateFlows.length
  });

  const inferredDefaultStage = inferDefaultStage(normalizedCandidateContext);
  const normalizedCandidateEvents = normalizedCandidateContext.candidateEvents.map((event) => ({
    ...event,
    stage: inferEventStage(event.stage, event.event_title, inferredDefaultStage)
  }));
  const normalizedFlowStages = unique(normalizedCandidateEvents.map((event) => event.stage));

  return canonicalizeContext({
    recognizedFlows: normalizedCandidateContext.candidateFlows.map((flow) => ({
      name: flow.name,
      description: flow.description.trim() || `Fluxo derivado de ${flow.name}.`,
      stages: flow.stages.length > 0 ? flow.stages : normalizedFlowStages,
      actors: flow.actors,
      services: flow.services,
      confidence: flow.confidence
    })),
    rows: normalizedCandidateEvents.map((event) => ({
      ordem: event.ordem,
      event_key: event.event_title,
      event_title: event.event_title,
      stage: event.stage,
      actor: event.actor.trim() || 'sistema',
      service: event.service.trim() || inferDefaultService(candidateContext),
      tags: event.tags.trim() || inferDefaultTags(candidateContext),
      dashboard_widget: 'event_stream',
      query_hint: ''
    })),
    assumptions: normalizedCandidateContext.assumptions
  });
}

export function applyNormalizationReview(
  candidateContext: CandidateContext,
  review: NormalizationReview | null
): RecognizedContext {
  if (!review) {
    logger.warn('Nenhuma revisão fornecida; usando contexto determinístico derivado dos candidatos');
    return candidateContextToRecognizedContext(candidateContext);
  }

  logger.info('Aplicando revisão de normalização', {
    correctionCount: review.corrections.length,
    correctedFlowCount: review.correctedFlows.length
  });

  const correctionsByOrder = new Map(review.corrections.map((correction) => [correction.ordem, correction]));
  const reviewedCandidateContext: CandidateContext = {
    candidateFlows: candidateContext.candidateFlows,
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
          actor: event.actor,
          service: event.service,
          tags: event.tags
        };
      })
      .filter((event): event is CandidateContext['candidateEvents'][number] => event !== null),
    discardedItems: candidateContext.discardedItems,
    assumptions: unique([...candidateContext.assumptions, ...review.assumptions])
  };

  return candidateContextToRecognizedContext(reviewedCandidateContext);
}

function inferDefaultStage(candidateContext: CandidateContext): string {
  return slugify(
    candidateContext.candidateFlows[0]?.name
      || candidateContext.candidateEvents[0]?.service
      || 'event_storming_flow'
  );
}

function inferDefaultService(candidateContext: CandidateContext): string {
  return slugify(
    candidateContext.candidateFlows[0]?.services[0]
      || candidateContext.candidateEvents[0]?.service
      || 'event_storming_service'
  );
}

function inferDefaultTags(candidateContext: CandidateContext): string {
  const service = inferDefaultService(candidateContext);
  return `journey:event_storming,service:${service}`;
}

function inferEventStage(stage: string, eventTitle: string, defaultStage: string): string {
  const normalizedStage = slugify(stage);
  const normalizedTitle = slugify(eventTitle);
  if (normalizedStage === '' || normalizedStage === normalizedTitle) {
    return defaultStage;
  }
  return stage;
}

export function imageObservationToCandidateContext(observation: ImageObservation): CandidateContext {
  logger.info('Convertendo observação da imagem em candidatos determinísticos', {
    touchPointCount: observation.touchPointsDetected.length,
    correlationCount: observation.touchPointEventCorrelations.length,
    detectedFlowCount: observation.flowsDetected.length
  });

  const observedEvents = unique(observation.textsOutsideShapes.map((item) => item.trim()).filter(Boolean));
  const validTouchPoints = unique(observation.touchPointsDetected.map((item) => item.trim()).filter(Boolean));
  const sanitizedCorrelations = observation.touchPointEventCorrelations.map((correlation) => ({
    ...correlation,
    touchPointTitle: correlation.touchPointTitle.trim(),
    eventsObservedAroundTouchPoint: unique(
      correlation.eventsObservedAroundTouchPoint
        .map((item) => item.trim())
        .filter((item) => item !== '' && observedEvents.includes(item))
    )
  }));
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

  const flattenedEvents = eventOrder.map((eventTitle) => {
    const matchingCorrelation = sanitizedCorrelations
      .filter((correlation) => correlation.eventsObservedAroundTouchPoint.includes(eventTitle))
      .sort((left, right) => right.confidence - left.confidence)[0];
    const semantic = eventVisualSemanticsByTitle.get(eventTitle);
    const semanticTag = semantic?.role === 'protagonist'
      ? 'event_role:protagonist'
      : semantic?.role === 'supporting'
        ? 'event_role:supporting'
        : 'event_role:unknown';

    return {
      event_title: eventTitle,
      stage: deriveDomainModelStage(
        eventTitle,
        matchingCorrelation?.touchPointTitle
          || inferStageFromEventTitle(eventTitle, validTouchPoints)
          || validTouchPoints[0]
          || 'event_storming_flow'
      ),
      actor: observation.actorsDetected[0]?.trim() || 'sistema',
      service: observation.servicesDetected[0]?.trim() || 'event_storming_service',
      tags: `journey:event_storming,domain:event_storming,${semanticTag}`
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
        actors: observation.actorsDetected.filter(Boolean),
        services: observation.servicesDetected.filter(Boolean),
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
            actors: observation.actorsDetected.filter(Boolean),
            services: observation.servicesDetected.filter(Boolean),
            confidence: correlation.confidence
        }));

  return {
    candidateFlows: candidateFlows.length > 0
      ? candidateFlows
      : [
          {
            name: 'fluxo_reconhecido',
            description: 'Fluxo derivado deterministicamente da observação da imagem.',
            orderedEventTitles: uniqueEvents.map((event) => event.event_title),
            stages: unique(uniqueEvents.map((event) => event.stage)),
            actors: observation.actorsDetected.filter(Boolean),
            services: observation.servicesDetected.filter(Boolean),
            confidence: 0.5
          }
        ],
    candidateEvents: uniqueEvents,
    discardedItems: observation.uncertainItems,
    assumptions: observation.assumptions
  };
}

export function normalizeCandidateContextDomainModels(candidateContext: CandidateContext): CandidateContext {
  logger.info('Normalizando candidateContext para stages por domain model', {
    candidateEventCount: candidateContext.candidateEvents.length,
    candidateFlowCount: candidateContext.candidateFlows.length
  });

  const normalizedEvents = candidateContext.candidateEvents.map((event) => ({
    ...event,
    stage: deriveDomainModelStage(event.event_title, event.stage)
  }));
  const normalizedStageByEventTitle = new Map(normalizedEvents.map((event) => [event.event_title, event.stage]));

  return {
    ...candidateContext,
    candidateFlows: candidateContext.candidateFlows.map((flow) => ({
      ...flow,
      stages: unique(
        flow.orderedEventTitles
          .map((eventTitle) => normalizedStageByEventTitle.get(eventTitle) || deriveDomainModelStage(eventTitle, flow.name))
          .filter(Boolean)
      )
    })),
    candidateEvents: normalizedEvents
  };
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

  return unique(touchPoints.map((touchPoint) => deriveDomainModelStage(touchPoint, touchPoint)));
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
  const preferredTokens = eventTokens.length > 0 ? eventTokens : contextualTokens;

  if (preferredTokens.length === 0) {
    return contextualStage;
  }

  const canonicalTokens = preferredTokens.map(singularizeToken).filter(Boolean);
  const stage = canonicalTokens.slice(0, 2).join('_');
  return stage === '' ? contextualStage : stage;
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
  'salva',
  'salvo',
  'salvos',
  'salvas',
  'encontrado',
  'encontrada',
  'encontrados',
  'encontradas',
  'nao',
  'pendente',
  'pendentes',
  'criada',
  'criado',
  'criadas',
  'criados'
]);

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

  const rows = context.rows
    .slice()
    .sort((left, right) => left.ordem - right.ordem)
    .map((row, index) => {
      const eventKey = slugify(row.event_key);
      const stage = slugify(row.stage);
      const service = slugify(row.service);

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
        actor: row.actor.trim(),
        service,
        tags: row.tags.trim(),
        dashboard_widget: row.dashboard_widget,
        query_hint: `tags:(event_key:${eventKey} service:${service} source:odd)`
      };
    });

  const stages = unique(rows.map((row) => row.stage));
  const services = unique(rows.map((row) => row.service));
  const actors = unique(rows.map((row) => row.actor));

  const recognizedFlows = context.recognizedFlows.length > 0
    ? context.recognizedFlows.map((flow) => ({
        ...flow,
        stages: unique(flow.stages.map(slugify)).filter((stage) => stages.includes(stage)),
        services: unique(flow.services.map(slugify)).filter((service) => services.includes(service)),
        actors: unique(flow.actors.map((actor) => actor.trim())).filter((actor) => actors.includes(actor))
      }))
    : [
        {
          name: 'fluxo_reconhecido',
          description: 'Fluxo consolidado a partir da imagem de event storming.',
          stages,
          actors,
          services,
          confidence: 0.7
        }
      ];

  const assumptions = unique(context.assumptions.map((item) => item.trim()).filter(Boolean));

  logger.info('Contexto normalizado', {
    rowCount: rows.length,
    flowCount: recognizedFlows.length,
    assumptionCount: assumptions.length
  });

  return {
    recognizedFlows,
    rows,
    assumptions
  };
}
