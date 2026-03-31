import { readJsonFile } from '../../shared/fs.js';
import { Logger } from '../../shared/logger.js';
import { CustomEventPayload, EventIngestionResult } from '../../shared/types.js';

const logger = new Logger('applier-datadog');

export async function readEvents(filePath: string): Promise<CustomEventPayload[]> {
  const events = await readJsonFile<CustomEventPayload[]>(filePath);
  logger.info('Arquivo de eventos carregado', {
    filePath,
    eventCount: events.length
  });
  return events;
}

export async function ingestEvents(filePath: string, dryRun: boolean): Promise<EventIngestionResult[]> {
  const events = await readEvents(filePath);
  const batchSize = resolveBatchSize();
  logger.info('Iniciando ingestão Datadog', {
    filePath,
    dryRun,
    eventCount: events.length,
    batchSize
  });

  if (dryRun) {
    logger.info('Ingestão Datadog em dry-run concluída', {
      eventCount: events.length
    });
    return events.map((event) => ({
      title: event.title,
      status: 'dry-run'
    }));
  }

  const results: EventIngestionResult[] = [];
  for (let index = 0; index < events.length; index += batchSize) {
    const chunk = events.slice(index, index + batchSize);
    logger.debug('Enviando lote de eventos Datadog', {
      chunkStart: index,
      chunkSize: chunk.length
    });
    const chunkResults = await Promise.all(
      chunk.map(async (event) => {
        try {
          const response = await sendEvent(event);
          logger.debug('Evento Datadog enviado', {
            title: event.title
          });
          return {
            title: event.title,
            status: 'sent',
            response
          } satisfies EventIngestionResult;
        } catch (error) {
          logger.warn('Falha no envio de evento Datadog', {
            title: event.title,
            error: error instanceof Error ? error.message : String(error)
          });
          return {
            title: event.title,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          } satisfies EventIngestionResult;
        }
      })
    );
    results.push(...chunkResults);
  }

  logger.info('Ingestão Datadog concluída', {
    total: results.length,
    failed: results.filter((item) => item.status === 'failed').length
  });
  return results;
}

function resolveBatchSize(): number {
  const raw = process.env.DD_EVENT_BATCH_SIZE;
  if (!raw) {
    return 10;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
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
