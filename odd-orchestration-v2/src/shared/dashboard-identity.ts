import { createHash } from 'node:crypto';

export function normalizeDashboardSlug(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'odd-dashboard';
}

export function buildDashboardKey(args: {
  dashboardTitle: string;
  provider: string;
  explicitKey?: string;
  identitySource?: string;
}): string {
  if (args.explicitKey && args.explicitKey.trim() !== '') {
    return normalizeDashboardSlug(args.explicitKey);
  }

  const slug = normalizeDashboardSlug(args.dashboardTitle);
  const hash = createHash('sha1')
    .update(`${args.provider}|${args.identitySource ?? slug}`)
    .digest('hex')
    .slice(0, 8);

  return `${slug}-${hash}`;
}
