import path from 'node:path';
import { readFileSync } from 'node:fs';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('image-message');

export function imageContentFromFile(filePath: string) {
  const mimeType = extensionToMime(path.extname(filePath).toLowerCase());
  const base64 = readFileSync(filePath).toString('base64');

  logger.debug('Imagem convertida para payload multimodal', {
    filePath,
    mimeType,
    encodedLength: base64.length
  });

  return {
    type: 'image_url' as const,
    image_url: {
      url: `data:${mimeType};base64,${base64}`
    }
  };
}

function extensionToMime(extension: string): string {
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}
