import { ImageObservation } from '../../domain/event-storming-schema.js';
import { t } from '../../shared/i18n.js';

export function composeBusinessTransactionRoutes(
  flows: ImageObservation['flowsDetected'],
  touchPointByEvent: Map<string, string>,
  validTouchPoints: string[]
): ImageObservation['flowsDetected'] {
  const mainFlow = selectMainTransactionFlow(flows);
  if (!mainFlow) {
    return flows;
  }

  return flows.map((flow) => {
    if (!shouldExpandAlternateTransactionRoute(flow, mainFlow)) {
      return flow;
    }

    const replacementIndex = findMainRouteReplacementIndex(mainFlow.orderedEventTitles, flow.orderedEventTitles);
    if (replacementIndex === -1) {
      return flow;
    }

    const expandedEventTitles = uniqueStrings([
      ...mainFlow.orderedEventTitles.slice(0, replacementIndex),
      ...flow.orderedEventTitles,
      ...mainFlow.orderedEventTitles.slice(replacementIndex + 1)
    ]);

    return {
      ...flow,
      orderedEventTitles: expandedEventTitles,
      touchPoints: routeTouchPoints(expandedEventTitles, flow, mainFlow, touchPointByEvent, validTouchPoints),
      confidence: Math.min(flow.confidence, mainFlow.confidence),
      reasoning: uniqueStrings([
        flow.reasoning,
        t('flow.transactionRouteComposition', { main: mainFlow.name })
      ]).join(' ')
    };
  });
}

function selectMainTransactionFlow(
  flows: ImageObservation['flowsDetected']
): ImageObservation['flowsDetected'][number] | undefined {
  const mainFlows = flows.filter((flow) => flow.flowType === 'main');
  if (mainFlows.length > 0) {
    return longestFlow(mainFlows);
  }

  const nonAlternateFlows = flows.filter((flow) => flow.flowType !== 'alternate');
  return longestFlow(nonAlternateFlows.length > 0 ? nonAlternateFlows : flows);
}

function longestFlow(
  flows: ImageObservation['flowsDetected']
): ImageObservation['flowsDetected'][number] | undefined {
  return [...flows].sort((left, right) => right.orderedEventTitles.length - left.orderedEventTitles.length)[0];
}

function shouldExpandAlternateTransactionRoute(
  flow: ImageObservation['flowsDetected'][number],
  mainFlow: ImageObservation['flowsDetected'][number]
): boolean {
  if (flow === mainFlow || flow.flowType !== 'alternate') {
    return false;
  }
  if (flow.orderedEventTitles.length === 0 || mainFlow.orderedEventTitles.length === 0) {
    return false;
  }

  const mainEventKeys = new Set(mainFlow.orderedEventTitles.map(equivalenceKey));
  const sharedMainEventCount = flow.orderedEventTitles
    .filter((eventTitle) => mainEventKeys.has(equivalenceKey(eventTitle)))
    .length;
  return sharedMainEventCount < 2;
}

function findMainRouteReplacementIndex(mainEventTitles: string[], alternateEventTitles: string[]): number {
  let bestMatch = { index: -1, score: 0 };

  for (let index = 0; index < mainEventTitles.length; index += 1) {
    const score = Math.max(
      ...alternateEventTitles.map((alternateEventTitle) => tokenSimilarity(mainEventTitles[index], alternateEventTitle))
    );
    if (score > bestMatch.score) {
      bestMatch = { index, score };
    }
  }

  return bestMatch.score >= 0.45 ? bestMatch.index : -1;
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

function tokenSet(value: string): Set<string> {
  return new Set(
    equivalenceKey(value)
      .split('_')
      .map((token) => token.trim())
      .filter((token) => token.length > 1)
  );
}

function routeTouchPoints(
  eventTitles: string[],
  alternateFlow: ImageObservation['flowsDetected'][number],
  mainFlow: ImageObservation['flowsDetected'][number],
  touchPointByEvent: Map<string, string>,
  validTouchPoints: string[]
): string[] {
  const routeTouchPointsFromEvents = eventTitles
    .map((eventTitle) => equivalentTouchPointForEvent(eventTitle, touchPointByEvent))
    .filter((touchPointTitle): touchPointTitle is string => Boolean(touchPointTitle))
    .filter((touchPointTitle) => hasEquivalent(touchPointTitle, validTouchPoints));

  if (routeTouchPointsFromEvents.length > 0) {
    return uniqueStrings(routeTouchPointsFromEvents);
  }

  return uniqueStrings([
    ...mainFlow.touchPoints,
    ...alternateFlow.touchPoints
  ]).filter((touchPointTitle) => hasEquivalent(touchPointTitle, validTouchPoints));
}

function equivalentTouchPointForEvent(eventTitle: string, touchPointByEvent: Map<string, string>): string | undefined {
  const exact = touchPointByEvent.get(eventTitle.trim());
  if (exact) {
    return exact;
  }

  const eventKey = equivalenceKey(eventTitle);
  for (const [candidateEventTitle, touchPointTitle] of touchPointByEvent.entries()) {
    if (equivalenceKey(candidateEventTitle) === eventKey) {
      return touchPointTitle;
    }
  }
  return undefined;
}

function hasEquivalent(value: string, candidates: string[]): boolean {
  const key = equivalenceKey(value);
  return candidates.some((candidate) => equivalenceKey(candidate) === key);
}

function equivalenceKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/nga/g, 'nca')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
