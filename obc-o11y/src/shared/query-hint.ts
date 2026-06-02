function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeEnv(env?: string): string {
  return slugify(env || 'dev') || 'dev';
}

export function buildEventQueryHint(eventKey: string, env?: string): string {
  return `tags:(event_key:${eventKey} env:${normalizeEnv(env)})`;
}

export function buildEnvTag(env?: string): string {
  return `env:${normalizeEnv(env)}`;
}
