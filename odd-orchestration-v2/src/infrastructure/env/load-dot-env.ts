import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const DEFAULT_ENV_PATHS = [
  '.env',
  path.resolve(process.cwd(), '../event-storming/bedrock/.env')
];

export function loadDotEnv(filePaths = DEFAULT_ENV_PATHS): void {
  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }

      const separator = trimmed.indexOf('=');
      if (separator <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
