import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { OcrObservation } from '../../domain/event-storming-schema.js';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('technical-label-ocr');
const require = createRequire(import.meta.url);

type OcrOptions = {
  outputDir: string;
};

type ExtractedLine = {
  text: string;
  confidence: number;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
};

export async function recognizeTechnicalLabels(
  inputImage: string,
  options: OcrOptions
): Promise<OcrObservation> {
  logger.info('Iniciando OCR técnico de labels', { inputImage });

  const preprocessedImage = path.join(options.outputDir, '00-ocr-red-labels.png');
  const scale = await createRedTextMask(inputImage, preprocessedImage);
  const lines = await runTesseract(preprocessedImage);
  const texts = await addReviewCrops(inputImage, options.outputDir, uniqueOcrTexts(
    lines.flatMap((line) => extractTechnicalTexts(line, scale))
  ));

  logger.info('OCR técnico concluído', {
    inputImage,
    preprocessedImage,
    textCount: texts.length
  });

  return {
    inputImage,
    preprocessedImage,
    texts,
    assumptions: texts.some((text) => text.needsOcrReview)
      ? ['OCR detectou labels técnicas com baixa confiança ou caracteres ambíguos; use a imagem original para revisar antes de tratar como definitivo.']
      : []
  };
}

async function addReviewCrops(
  inputImage: string,
  outputDir: string,
  texts: OcrObservation['texts']
): Promise<OcrObservation['texts']> {
  const metadata = await sharp(inputImage).metadata();
  const imageWidth = metadata.width ?? 0;
  const imageHeight = metadata.height ?? 0;

  return Promise.all(texts.map(async (text, index) => {
    if (!text.needsOcrReview || !text.bbox || imageWidth === 0 || imageHeight === 0) {
      return text;
    }

    const paddingX = Math.max(24, Math.round(text.bbox.width * 0.25));
    const paddingY = Math.max(18, Math.round(text.bbox.height * 1.5));
    const left = Math.max(0, text.bbox.x - paddingX);
    const top = Math.max(0, text.bbox.y - paddingY);
    const right = Math.min(imageWidth, text.bbox.x + text.bbox.width + paddingX);
    const bottom = Math.min(imageHeight, text.bbox.y + text.bbox.height + paddingY);
    const cropImage = path.join(outputDir, `00-ocr-review-crop-${index + 1}.png`);

    await sharp(inputImage)
      .extract({
        left,
        top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top)
      })
      .resize({ width: 1400, withoutEnlargement: false })
      .sharpen()
      .png()
      .toFile(cropImage);

    return {
      ...text,
      cropImage
    };
  }));
}

async function createRedTextMask(inputImage: string, outputImage: string): Promise<number> {
  const metadata = await sharp(inputImage).metadata();
  const sourceWidth = metadata.width ?? 1;
  const targetWidth = Math.max(sourceWidth, 6000);
  const scale = targetWidth / sourceWidth;

  const { data, info } = await sharp(inputImage)
    .resize({ width: targetWidth, withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const isRedLabelPixel = red > 120 && red > green * 1.45 && red > blue * 1.45 && green < 140 && blue < 140;
    const value = isRedLabelPixel ? 0 : 255;

    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .grayscale()
    .sharpen()
    .png()
    .toFile(outputImage);

  return scale;
}

async function runTesseract(imagePath: string): Promise<ExtractedLine[]> {
  const worker = await Tesseract.createWorker('eng', 1, {
    langPath: resolveTesseractLangPath(),
    cacheMethod: 'none'
  });

  try {
    await worker.setParameters({
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-',
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      user_defined_dpi: '300'
    });

    const result = await worker.recognize(imagePath, {}, { text: true, blocks: true });
    return extractLines(result.data.blocks ?? []);
  } finally {
    await worker.terminate();
  }
}

function resolveTesseractLangPath(): string {
  const dataPackagePath = require.resolve('@tesseract.js-data/eng');
  return path.join(path.dirname(dataPackagePath), '4.0.0');
}

function extractLines(blocks: NonNullable<Tesseract.Page['blocks']>): ExtractedLine[] {
  return blocks.flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) => ({
        text: line.text,
        confidence: line.confidence,
        bbox: line.bbox
      }))
    )
  );
}

function extractTechnicalTexts(line: ExtractedLine, scale: number): OcrObservation['texts'] {
  const normalizedLine = normalizeOcrLine(line.text);
  const matches = normalizedLine.match(/[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+/g) ?? [];

  return matches.map((text) => ({
    text,
    confidence: clampConfidence(line.confidence),
    source: 'ocr_red_labels',
    colorHint: 'red',
    bbox: line.bbox
      ? {
          x: Math.round(line.bbox.x0 / scale),
          y: Math.round(line.bbox.y0 / scale),
          width: Math.round((line.bbox.x1 - line.bbox.x0) / scale),
          height: Math.round((line.bbox.y1 - line.bbox.y0) / scale)
        }
      : undefined,
    ocrAlternatives: [],
    ambiguousCharacters: findAmbiguousCharacters(text),
    needsOcrReview: hasSuspiciousMixedShortSegment(text) || line.confidence < 90
  }));
}

function normalizeOcrLine(value: string): string {
  return value
    .replace(/\s*([._-])\s*/g, '$1')
    .replace(/[^A-Za-z0-9._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueOcrTexts(texts: OcrObservation['texts']): OcrObservation['texts'] {
  const byText = new Map<string, OcrObservation['texts'][number]>();

  for (const text of texts) {
    const current = byText.get(text.text);
    if (!current || text.confidence > current.confidence) {
      byText.set(text.text, text);
    }
  }

  return [...byText.values()].sort((left, right) => {
    const leftY = left.bbox?.y ?? 0;
    const rightY = right.bbox?.y ?? 0;
    if (leftY !== rightY) {
      return leftY - rightY;
    }
    return (left.bbox?.x ?? 0) - (right.bbox?.x ?? 0);
  });
}

function clampConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) {
    return 0;
  }
  return Math.max(0, Math.min(100, confidence));
}

function findAmbiguousCharacters(text: string): string[] {
  if (!hasSuspiciousMixedShortSegment(text)) {
    return [];
  }

  return [...new Set(text.split(/[._-]+/).flatMap((segment) => {
    if (segment.length > 4 || !/[A-Za-z]/.test(segment) || !/\d/.test(segment)) {
      return [];
    }
    return [...segment].filter((character) => /[A-Za-z0-9]/.test(character));
  }))];
}

function hasSuspiciousMixedShortSegment(label: string): boolean {
  return label
    .split(/[._-]+/)
    .some((segment) => segment.length > 0 && segment.length <= 4 && /[A-Za-z]/.test(segment) && /\d/.test(segment));
}
