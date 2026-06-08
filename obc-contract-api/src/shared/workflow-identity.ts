import { createHash } from 'node:crypto';
import path from 'node:path';

export function normalizeWorkflowKey(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'event-storming';
}

export function buildWorkflowKey(args: {
  inputImage: string;
  provider: string;
  explicitKey?: string;
}): string {
  if (args.explicitKey && args.explicitKey.trim() !== '') {
    return normalizeWorkflowKey(args.explicitKey);
  }

  const imageName = path.basename(args.inputImage, path.extname(args.inputImage));
  const slug = normalizeWorkflowKey(imageName);
  const hash = createHash('sha1')
    .update(`${args.provider}|${path.resolve(args.inputImage)}`)
    .digest('hex')
    .slice(0, 8);

  return `${slug}-${hash}`;
}

export function buildRunId(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
