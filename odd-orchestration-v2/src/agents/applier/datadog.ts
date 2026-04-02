import { readJsonFile } from '../../shared/fs.js';
import { Logger } from '../../shared/logger.js';
import { buildEnvTag, normalizeEnv } from '../../shared/query-hint.js';
import { CustomEventPayload, DashboardPlan, EventBurstConfig, EventIngestionResult, MetricIngestionResult, SloSuggestion } from '../../shared/types.js';

const logger = new Logger('applier-datadog');
const EVENT_METRIC = 'odd.workflow.event.count';
const GOOD_METRIC = 'odd.workflow.slo.good';
const TOTAL_METRIC = 'odd.workflow.slo.total';
const DASHBOARD_WINDOW_SECONDS = 5 * 60;
const DEFAULT_RANDOM_MAX_COPIES = 5;

export async function readEvents(filePath: string): Promise<CustomEventPayload[]> {
  const events = await readJsonFile<CustomEventPayload[]>(filePath);
  logger.info('Arquivo de eventos carregado', {
    filePath,
    eventCount: events.length
  });
  return events;
}

export async function ingestEvents(
  filePath: string,
  dryRun: boolean,
  burstOverrides: Partial<EventBurstConfig> = {}
): Promise<{
  burstConfig: EventBurstConfig;
  scheduledEventsCount: number;
  results: EventIngestionResult[];
}> {
  const events = await readEvents(filePath);
  const batchSize = resolveBatchSize();
  const burstConfig = resolveBurstConfig(burstOverrides);
  const scheduledEvents = expandEventsForSimulation(events, burstConfig);
  const scheduledEventsCount = scheduledEvents.length;
  logger.info('Iniciando ingestão Datadog', {
    filePath,
    dryRun,
    eventCount: events.length,
    batchSize,
    burstCount: burstConfig.burstCount,
    burstIntervalMs: burstConfig.burstIntervalMs,
    copiesPerEvent: burstConfig.copiesPerEvent,
    randomizeEventCounts: burstConfig.randomizeEventCounts,
    scheduledEventsCount
  });

  if (dryRun) {
    logger.info('Ingestão Datadog em dry-run concluída', {
      scheduledEventsCount
    });
    return {
      burstConfig,
      scheduledEventsCount,
      results: scheduledEvents.map((item) => ({
        title: item.event.title,
        burstIndex: item.burstIndex,
        copyIndex: item.copyIndex,
        status: 'dry-run'
      }))
    };
  }

  const results: EventIngestionResult[] = [];

  for (let index = 0; index < scheduledEvents.length; index += batchSize) {
    const chunk = scheduledEvents.slice(index, index + batchSize);
    const burstIndex = chunk[0]?.burstIndex ?? 0;
    logger.debug('Enviando lote de eventos Datadog', {
      chunkStart: index,
      chunkSize: chunk.length,
      burstIndex
    });
    const chunkResults = await Promise.all(
      chunk.map(async ({ event, burstIndex: eventBurstIndex, copyIndex }) => {
        try {
          const response = await sendEvent(event);
          logger.debug('Evento Datadog enviado', {
            title: event.title,
            burstIndex: eventBurstIndex,
            copyIndex
          });
          return {
            title: event.title,
            burstIndex: eventBurstIndex,
            copyIndex,
            status: 'sent',
            response
          } satisfies EventIngestionResult;
        } catch (error) {
          logger.warn('Falha no envio de evento Datadog', {
            title: event.title,
            burstIndex: eventBurstIndex,
            copyIndex,
            error: error instanceof Error ? error.message : String(error)
          });
          return {
            title: event.title,
            burstIndex: eventBurstIndex,
            copyIndex,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          } satisfies EventIngestionResult;
        }
      })
    );
    results.push(...chunkResults);

    const nextBurstIndex = scheduledEvents[index + chunk.length]?.burstIndex;
    if (nextBurstIndex && nextBurstIndex !== burstIndex && burstConfig.burstIntervalMs > 0) {
      logger.info('Aguardando próxima rajada de eventos', {
        currentBurstIndex: burstIndex,
        nextBurstIndex,
        waitMs: burstConfig.burstIntervalMs
      });
      await wait(burstConfig.burstIntervalMs);
    }
  }

  logger.info('Ingestão Datadog concluída', {
    total: results.length,
    failed: results.filter((item) => item.status === 'failed').length,
    scheduledEventsCount
  });
  return {
    burstConfig,
    scheduledEventsCount,
    results
  };
}

export async function ingestSloMetrics(args: {
  dashboardKey: string;
  planFile?: string;
  dryRun: boolean;
  burstConfig?: Partial<EventBurstConfig>;
}): Promise<{
  results: MetricIngestionResult[];
}> {
  if (!args.planFile) {
    logger.info('Ingestão de métricas de SLO ignorada', {
      reason: 'planFile ausente'
    });
    return { results: [] };
  }

  const plan = await readJsonFile<DashboardPlan>(args.planFile);
  const burstConfig = resolveBurstConfig(args.burstConfig ?? {});
  const series = [
    ...buildEventMetricSeries(plan, args.dashboardKey, burstConfig),
    ...buildSloMetricSeries(plan, args.dashboardKey, burstConfig)
  ];
  logger.info('Iniciando ingestão de métricas de SLO', {
    planFile: args.planFile,
    dashboardKey: args.dashboardKey,
    seriesCount: series.length,
    dryRun: args.dryRun
  });

  if (args.dryRun) {
    return {
      results: series.map((item) => ({
        metric: item.metric,
        points: item.points.length,
        status: 'dry-run'
      }))
    };
  }

  try {
    await sendMetrics(series);
    return {
      results: series.map((item) => ({
        metric: item.metric,
        points: item.points.length,
        status: 'sent'
      }))
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Falha no envio de métricas de SLO', {
      error: message
    });
    return {
      results: series.map((item) => ({
        metric: item.metric,
        points: item.points.length,
        status: 'failed',
        error: message
      }))
    };
  }
}

function resolveBatchSize(): number {
  const raw = process.env.DD_EVENT_BATCH_SIZE;
  if (!raw) {
    return 10;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function resolveBurstConfig(overrides: Partial<EventBurstConfig>): EventBurstConfig {
  const randomizeEventCounts = overrides.randomizeEventCounts === true;
  return {
    burstCount: resolvePositiveInteger(overrides.burstCount, process.env.DD_EVENT_BURST_COUNT, 1),
    burstIntervalMs: resolveNonNegativeInteger(overrides.burstIntervalMs, process.env.DD_EVENT_BURST_INTERVAL_MS, 0),
    copiesPerEvent: resolvePositiveInteger(
      overrides.copiesPerEvent,
      process.env.DD_EVENT_BURST_REPEAT_PER_EVENT,
      randomizeEventCounts ? DEFAULT_RANDOM_MAX_COPIES : 1
    ),
    randomizeEventCounts,
    randomSeed: Number.isFinite(overrides.randomSeed) ? (overrides.randomSeed as number) : Date.now()
  };
}

function resolvePositiveInteger(override: number | undefined, envValue: string | undefined, fallback: number): number {
  if (Number.isFinite(override) && (override as number) > 0) {
    return override as number;
  }

  const parsed = envValue ? Number.parseInt(envValue, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveNonNegativeInteger(override: number | undefined, envValue: string | undefined, fallback: number): number {
  if (Number.isFinite(override) && (override as number) >= 0) {
    return override as number;
  }

  const parsed = envValue ? Number.parseInt(envValue, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function expandEventsForSimulation(events: CustomEventPayload[], burstConfig: EventBurstConfig) {
  const expanded: Array<{ event: CustomEventPayload; burstIndex: number; copyIndex: number }> = [];

  for (let burstIndex = 1; burstIndex <= burstConfig.burstCount; burstIndex += 1) {
    for (const baseEvent of events) {
      const copiesForEvent = resolveCopiesForEvent(baseEvent.title, burstIndex, burstConfig);
      for (let copyIndex = 1; copyIndex <= copiesForEvent; copyIndex += 1) {
        expanded.push({
          event: withSimulationMetadata(baseEvent, burstIndex, copyIndex, copiesForEvent, burstConfig),
          burstIndex,
          copyIndex
        });
      }
    }
  }

  return expanded;
}

function withSimulationMetadata(
  event: CustomEventPayload,
  burstIndex: number,
  copyIndex: number,
  copiesForEvent: number,
  burstConfig: EventBurstConfig
): CustomEventPayload {
  const tags = [
    ...event.tags,
    'simulation:true',
    'simulation_profile:periodic_burst',
    `simulation_randomized:${burstConfig.randomizeEventCounts}`,
    `simulation_burst:${burstIndex}`,
    `simulation_copy:${copyIndex}`,
    `simulation_copies_for_event:${copiesForEvent}`,
    `simulation_total_bursts:${burstConfig.burstCount}`
  ];

  return {
    ...event,
    text: `${event.text}\n\nSimulation burst ${burstIndex}/${burstConfig.burstCount}, copy ${copyIndex}/${burstConfig.copiesPerEvent}.`,
    tags
  };
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendEvent(event: CustomEventPayload): Promise<unknown> {
  const apiKey = process.env.DD_API_KEY;
  const appKey = process.env.DD_APP_KEY;
  const site = process.env.DD_SITE ?? 'datadoghq.com';
  const baseUrl = process.env.DD_API_BASE_URL ?? `https://api.${site}`;

  if (!apiKey || !appKey) {
    throw new Error('DD_API_KEY e DD_APP_KEY são obrigatórios para ingestão real.');
  }

  logger.debug('Enviando evento para API Datadog', {
    title: event.title,
    baseUrl,
    tagCount: event.tags.length
  });

  const response = await fetch(`${baseUrl}/api/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': apiKey,
      'DD-APPLICATION-KEY': appKey
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    throw new Error(`Erro ao enviar evento ${event.title}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function buildSloMetricSeries(plan: DashboardPlan, dashboardKey: string, burstConfig: EventBurstConfig) {
  const burstTimestamps = buildBurstTimestamps(burstConfig);
  const series: Array<{
    metric: string;
    type: 'count';
    points: Array<[number, number]>;
    tags: string[];
  }> = [];

  for (const slo of plan.sloSuggestions) {
    const tags = [
      'source:odd',
      buildEnvTag(resolveEnvFromPlan(plan)),
      `dashboard_key:${dashboardKey}`,
      `slo_id:${slo.id}`,
      `sli_type:${slo.sliType}`
    ];

    series.push({
      metric: GOOD_METRIC,
      type: 'count',
      points: burstTimestamps.map((timestamp, index) => [timestamp, estimateSloCountsForBurst(plan, slo, index + 1, burstConfig).good]),
      tags
    });
    series.push({
      metric: TOTAL_METRIC,
      type: 'count',
      points: burstTimestamps.map((timestamp, index) => [timestamp, estimateSloCountsForBurst(plan, slo, index + 1, burstConfig).total]),
      tags
    });
  }

  return series;
}

function buildEventMetricSeries(plan: DashboardPlan, dashboardKey: string, burstConfig: EventBurstConfig) {
  const burstTimestamps = buildBurstTimestamps(burstConfig);
  return plan.customEvents.map((event) => ({
    metric: EVENT_METRIC,
    type: 'count' as const,
    points: burstTimestamps.map((timestamp, index) => [timestamp, resolveCopiesForEvent(event.title, index + 1, burstConfig)]) as Array<[number, number]>,
    tags: [
      'source:odd',
      buildEnvTag(resolveEnvFromPlan(plan)),
      `dashboard_key:${dashboardKey}`,
      ...event.tags.filter(Boolean)
    ]
  }));
}

function resolveEnvFromPlan(plan: DashboardPlan): string {
  const envTag = plan.customEvents
    .flatMap((event) => event.tags)
    .find((tag) => tag.startsWith('env:'));

  return normalizeEnv(envTag?.slice(4));
}

function estimateSloCountsForBurst(plan: DashboardPlan, slo: SloSuggestion, burstIndex: number, burstConfig: EventBurstConfig) {
  const sourceEvents = plan.customEvents.filter((event) => slo.sourceEventKeys.includes(event.title));
  const eventCount = sourceEvents.length > 0
    ? sourceEvents.reduce((sum, event) => sum + resolveCopiesForEvent(event.title, burstIndex, burstConfig), 0)
    : Math.max(1, slo.sourceOccurrenceKeys?.length ?? 1) * resolveCopiesForEvent(slo.id, burstIndex, burstConfig);
  const target = parseTargetPercentage(slo.target);
  const successRatio = slo.sliType === 'error_rate'
    ? (target <= 50 ? (100 - target) / 100 : target / 100)
    : target / 100;
  const boundedRatio = Math.max(0.5, Math.min(0.9999, successRatio));
  const total = slo.sliType === 'error_rate' ? eventCount * 20 : eventCount;
  const good = Math.max(1, Math.min(total, Math.round(total * boundedRatio)));

  return { good, total };
}

function resolveCopiesForEvent(identifier: string, burstIndex: number, burstConfig: EventBurstConfig): number {
  if (!burstConfig.randomizeEventCounts) {
    return burstConfig.copiesPerEvent;
  }

  const maxCopies = Math.max(2, burstConfig.copiesPerEvent);
  const hash = hashString(`${burstConfig.randomSeed}:${identifier}:${burstIndex}`);
  return 1 + (hash % maxCopies);
}

function buildBurstTimestamps(burstConfig: EventBurstConfig): number[] {
  const now = Math.floor(Date.now() / 1000);
  if (burstConfig.burstCount <= 1) {
    return [now];
  }

  const interval = Math.max(1, Math.floor(DASHBOARD_WINDOW_SECONDS / burstConfig.burstCount));
  return Array.from({ length: burstConfig.burstCount }, (_, index) => {
    const reverseIndex = burstConfig.burstCount - 1 - index;
    return now - (reverseIndex * interval);
  });
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function parseTargetPercentage(target: string): number {
  const normalized = target.replace(',', '.');
  const matched = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!matched) {
    return 99;
  }

  const parsed = Number.parseFloat(matched[1]);
  if (!Number.isFinite(parsed)) {
    return 99;
  }

  return Math.max(1, Math.min(99.99, parsed));
}

async function sendMetrics(series: Array<{
  metric: string;
  type: 'count';
  points: Array<[number, number]>;
  tags: string[];
}>): Promise<void> {
  const apiKey = process.env.DD_API_KEY;
  const appKey = process.env.DD_APP_KEY;
  const site = process.env.DD_SITE ?? 'datadoghq.com';
  const baseUrl = process.env.DD_API_BASE_URL ?? `https://api.${site}`;

  if (!apiKey || !appKey) {
    throw new Error('DD_API_KEY e DD_APP_KEY são obrigatórios para envio real de métricas.');
  }

  const response = await fetch(`${baseUrl}/api/v1/series`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': apiKey,
      'DD-APPLICATION-KEY': appKey
    },
    body: JSON.stringify({ series })
  });

  if (!response.ok) {
    throw new Error(`Erro ao enviar métricas de SLO: ${response.status} ${await response.text()}`);
  }
}
