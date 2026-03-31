import { readJsonFile } from '../../shared/fs.js';
import { Logger } from '../../shared/logger.js';
import { CustomEventPayload, EventBurstConfig, EventIngestionResult } from '../../shared/types.js';

const logger = new Logger('applier-datadog');

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
  const scheduledEventsCount = events.length * burstConfig.burstCount * burstConfig.copiesPerEvent;
  logger.info('Iniciando ingestão Datadog', {
    filePath,
    dryRun,
    eventCount: events.length,
    batchSize,
    burstCount: burstConfig.burstCount,
    burstIntervalMs: burstConfig.burstIntervalMs,
    copiesPerEvent: burstConfig.copiesPerEvent,
    scheduledEventsCount
  });

  if (dryRun) {
    logger.info('Ingestão Datadog em dry-run concluída', {
      scheduledEventsCount
    });
    return {
      burstConfig,
      scheduledEventsCount,
      results: expandEventsForSimulation(events, burstConfig).map((item) => ({
        title: item.event.title,
        burstIndex: item.burstIndex,
        copyIndex: item.copyIndex,
        status: 'dry-run'
      }))
    };
  }

  const results: EventIngestionResult[] = [];
  const scheduledEvents = expandEventsForSimulation(events, burstConfig);

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

function resolveBatchSize(): number {
  const raw = process.env.DD_EVENT_BATCH_SIZE;
  if (!raw) {
    return 10;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function resolveBurstConfig(overrides: Partial<EventBurstConfig>): EventBurstConfig {
  return {
    burstCount: resolvePositiveInteger(overrides.burstCount, process.env.DD_EVENT_BURST_COUNT, 1),
    burstIntervalMs: resolveNonNegativeInteger(overrides.burstIntervalMs, process.env.DD_EVENT_BURST_INTERVAL_MS, 0),
    copiesPerEvent: resolvePositiveInteger(overrides.copiesPerEvent, process.env.DD_EVENT_BURST_REPEAT_PER_EVENT, 1)
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
      for (let copyIndex = 1; copyIndex <= burstConfig.copiesPerEvent; copyIndex += 1) {
        expanded.push({
          event: withSimulationMetadata(baseEvent, burstIndex, copyIndex, burstConfig),
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
  burstConfig: EventBurstConfig
): CustomEventPayload {
  const tags = [
    ...event.tags,
    'simulation:true',
    'simulation_profile:periodic_burst',
    `simulation_burst:${burstIndex}`,
    `simulation_copy:${copyIndex}`,
    `simulation_copies_per_event:${burstConfig.copiesPerEvent}`,
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
