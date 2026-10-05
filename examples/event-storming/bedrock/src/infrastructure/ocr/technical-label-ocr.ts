import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { ArrowDetections, FlowLegendDetections, OcrObservation, ShapeGeometry } from '../../domain/event-storming-schema.js';
import { Logger } from '../../shared/logger.js';
import { t } from '../../shared/i18n.js';

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
  logger.info(t('log.ocr.technical.start'), { inputImage });

  const preprocessedImage = path.join(options.outputDir, '00-ocr-red-labels.png');
  const scale = await createColorTextMask(inputImage, preprocessedImage, 'red');
  const lines = await runTesseractLoose(preprocessedImage);
  const texts = await addReviewCrops(inputImage, options.outputDir, uniqueOcrTexts(
    lines.flatMap((line) => extractColoredLabelTexts(line, scale, 'ocr_red_labels', 'red'))
  ));

  logger.info(t('log.ocr.technical.done'), {
    inputImage,
    preprocessedImage,
    textCount: texts.length
  });

  return {
    inputImage,
    preprocessedImage,
    texts,
    assumptions: texts.some((text) => text.needsOcrReview)
      ? [t('ocr.redLowConfidence')]
      : []
  };
}

export async function recognizeSupportingLabels(
  inputImage: string,
  options: OcrOptions
): Promise<OcrObservation> {
  logger.info(t('log.ocr.supporting.start'), { inputImage });

  const preprocessedImage = path.join(options.outputDir, '00-ocr-blue-labels.png');
  const scale = await createColorTextMask(inputImage, preprocessedImage, 'blue');
  const lines = await runTesseractLoose(preprocessedImage);
  const texts = await addReviewCrops(inputImage, options.outputDir, uniqueOcrTexts(
    lines.flatMap((line) => extractColoredLabelTexts(line, scale, 'ocr_blue_labels', 'blue'))
  ));

  logger.info(t('log.ocr.supporting.done'), {
    inputImage,
    preprocessedImage,
    textCount: texts.length
  });

  return {
    inputImage,
    preprocessedImage,
    texts,
    assumptions: texts.some((text) => text.needsOcrReview)
      ? [t('ocr.blueLowConfidence')]
      : []
  };
}

export async function recognizeFlowLegends(
  inputImage: string,
  options: OcrOptions
): Promise<FlowLegendDetections> {
  const preprocessedImage = path.join(options.outputDir, '00-ocr-flow-legends.png');
  const scale = await createFullTextImage(inputImage, preprocessedImage);
  const lines = await runTesseractLoose(preprocessedImage);
  const ocrTexts = uniqueOcrTexts(lines
    .map((line) => ({
      text: normalizeLegendLine(line.text),
      confidence: clampConfidence(line.confidence),
      source: 'ocr_flow_legends',
      bbox: line.bbox
        ? {
            x: Math.round(line.bbox.x0 / scale),
            y: Math.round(line.bbox.y0 / scale),
            width: Math.round((line.bbox.x1 - line.bbox.x0) / scale),
            height: Math.round((line.bbox.y1 - line.bbox.y0) / scale)
          }
        : undefined,
      ocrAlternatives: [],
      ambiguousCharacters: [],
      needsOcrReview: line.confidence < 70
    }))
    .filter((text) => text.text.length > 0));
  const legends = buildFlowLegendsFromOcr(ocrTexts);

  return {
    legends,
    ocrTexts,
    assumptions: legends.length === 0
      ? [t('ocr.flowLegendMissing')]
      : []
  };
}

export async function detectShapeGeometry(inputImage: string): Promise<ShapeGeometry> {
  const { data, info } = await sharp(inputImage)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const components = connectedComponents(data, info.width, info.height, (red, green, blue, alpha) => {
    if (alpha < 20) return false;
    if (isRedPixel(red, green, blue) || isBluePixel(red, green, blue) || isDarkPixel(red, green, blue)) return false;
    return !isNearWhite(red, green, blue);
  });
  const imageArea = info.width * info.height;
  const rawCandidates = components
    .filter((component) => component.width >= 60 && component.height >= 28 && component.pixelCount >= 200)
    .filter((component) => component.width * component.height >= 1200)
    .map((component, index) => ({
      id: `shape_${index + 1}`,
      bbox: { x: component.x, y: component.y, width: component.width, height: component.height },
      confidence: rectangleConfidence(component),
      reasoning: t('shape.componentReasoning')
    }));
  const candidates = reindexGeometryCandidates(mergeOverlappingGeometryCandidates(rawCandidates));
  const areaCandidates = candidates.filter((candidate) =>
    candidate.bbox.width * candidate.bbox.height > imageArea * 0.08
    || candidate.bbox.width > info.width * 0.45
    || candidate.bbox.height > info.height * 0.35
  );
  const areaIds = new Set(areaCandidates.map((candidate) => candidate.id));
  const touchPointCandidates = await labelTouchPointCandidates(
    inputImage,
    candidates.filter((candidate) => !areaIds.has(candidate.id))
  );

  return {
    imageWidth: info.width,
    imageHeight: info.height,
    touchPointCandidates,
    areaCandidates,
    assumptions: [
      t('shape.geometryAssumption'),
      t('shape.labelAssumption')
    ]
  };
}

export async function detectArrowGeometry(inputImage: string): Promise<ArrowDetections> {
  const { data, info } = await sharp(inputImage)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const darkComponents = connectedComponents(data, info.width, info.height, (red, green, blue, alpha) =>
    alpha >= 20 && isDarkPixel(red, green, blue)
  ).filter((component) => component.pixelCount >= 12);
  const longSegments = darkComponents.filter((component) =>
    (component.width >= 45 && component.height <= 18) || (component.height >= 45 && component.width <= 18)
  );
  const dashedGroups = groupDashedSegments(darkComponents);
  const arrows = [
    ...longSegments.map((component, index) => ({
      id: `arrow_solid_${index + 1}`,
      arrowStyle: 'solid' as const,
      flowType: 'main' as const,
      bbox: { x: component.x, y: component.y, width: component.width, height: component.height },
      direction: component.width >= component.height ? 'left_to_right' as const : 'top_to_bottom' as const,
      confidence: 0.62,
      reasoning: t('arrow.solidReasoning')
    })),
    ...dashedGroups.map((group, index) => ({
      id: `arrow_dashed_${index + 1}`,
      arrowStyle: 'dashed' as const,
      flowType: 'alternate' as const,
      bbox: group.bbox,
      direction: group.bbox.width >= group.bbox.height ? 'left_to_right' as const : 'top_to_bottom' as const,
      confidence: 0.56,
      reasoning: t('arrow.dashedReasoning')
    }))
  ];

  return {
    arrows,
    assumptions: arrows.length === 0
      ? [t('arrow.none')]
      : [t('arrow.assumption')]
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

async function createColorTextMask(inputImage: string, outputImage: string, color: 'red' | 'blue'): Promise<number> {
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
    const isLabelPixel = color === 'red' ? isRedPixel(red, green, blue) : isBluePixel(red, green, blue);
    const value = isLabelPixel ? 0 : 255;

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

async function createFullTextImage(inputImage: string, outputImage: string): Promise<number> {
  const metadata = await sharp(inputImage).metadata();
  const sourceWidth = metadata.width ?? 1;
  const targetWidth = Math.max(sourceWidth, 4000);
  const scale = targetWidth / sourceWidth;

  await sharp(inputImage)
    .resize({ width: targetWidth, withoutEnlargement: false })
    .grayscale()
    .normalize()
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

async function runTesseractLoose(imagePath: string | Buffer): Promise<ExtractedLine[]> {
  const worker = await Tesseract.createWorker('eng', 1, {
    langPath: resolveTesseractLangPath(),
    cacheMethod: 'none'
  });

  try {
    await worker.setParameters({
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

function extractTechnicalTexts(
  line: ExtractedLine,
  scale: number,
  source: 'ocr_red_labels' | 'ocr_blue_labels',
  colorHint: 'red' | 'blue'
): OcrObservation['texts'] {
  const normalizedLine = normalizeOcrLine(line.text);
  const matches = normalizedLine.match(/[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+/g) ?? [];

  return matches.map((text) => ({
    text,
    confidence: clampConfidence(line.confidence),
    source,
    colorHint,
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

function extractColoredLabelTexts(
  line: ExtractedLine,
  scale: number,
  source: 'ocr_red_labels' | 'ocr_blue_labels',
  colorHint: 'red' | 'blue'
): OcrObservation['texts'] {
  const normalizedLine = normalizeColoredLabelLine(line.text);
  if (!looksLikeUsefulLabel(normalizedLine)) {
    return [];
  }

  return [{
    text: normalizedLine,
    confidence: clampConfidence(line.confidence),
    source,
    colorHint,
    bbox: line.bbox
      ? {
          x: Math.round(line.bbox.x0 / scale),
          y: Math.round(line.bbox.y0 / scale),
          width: Math.round((line.bbox.x1 - line.bbox.x0) / scale),
          height: Math.round((line.bbox.y1 - line.bbox.y0) / scale)
        }
      : undefined,
    ocrAlternatives: [],
    ambiguousCharacters: findAmbiguousCharacters(normalizedLine),
    needsOcrReview: hasSuspiciousMixedShortSegment(normalizedLine) || line.confidence < 75
  }];
}

function buildFlowLegendsFromOcr(ocrTexts: OcrObservation['texts']): FlowLegendDetections['legends'] {
  const legends: FlowLegendDetections['legends'] = [];
  const sorted = [...ocrTexts].sort((left, right) => (left.bbox?.y ?? 0) - (right.bbox?.y ?? 0));

  for (let index = 0; index < sorted.length; index += 1) {
    const text = sorted[index];
    const flowType = inferFlowTypeFromLegend(text.text);
    if (flowType === 'unknown') {
      continue;
    }

    const headerY = text.bbox?.y ?? 0;
    const headerX = text.bbox?.x ?? 0;
    const orderedEventTitles = sorted
      .slice(index + 1)
      .filter((candidate) => {
        const y = candidate.bbox?.y ?? 0;
        const x = candidate.bbox?.x ?? 0;
        return y > headerY && y < headerY + 240 && Math.abs(x - headerX) < 420 && inferFlowTypeFromLegend(candidate.text) === 'unknown';
      })
      .map((candidate) => candidate.text)
      .filter((candidate) => candidate.length > 2);

    legends.push({
      name: text.text,
      flowType,
      bbox: text.bbox,
      orderedEventTitles,
      confidence: orderedEventTitles.length > 0 ? 0.72 : 0.45,
      reasoning: t('flow.legendHeaderReasoning')
    });
  }

  return legends;
}

function inferFlowTypeFromLegend(value: string): 'main' | 'alternate' | 'unknown' {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/caminho\s+(feliz|principal)|fluxo\s+principal|happy\s+path/.test(normalized)) return 'main';
  if (/caminho\s+alternativo|fluxo\s+alternativo|alternate\s+path/.test(normalized)) return 'alternate';
  return 'unknown';
}

function normalizeLegendLine(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}._\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Component = {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelCount: number;
};

type GeometryCandidate = ShapeGeometry['touchPointCandidates'][number];

async function labelTouchPointCandidates(
  inputImage: string,
  candidates: GeometryCandidate[]
): Promise<GeometryCandidate[]> {
  return Promise.all(candidates.map(async (candidate) => {
    const label = await recognizeShapeLabel(inputImage, candidate.bbox);
    if (!label) {
      return candidate;
    }
    return {
      ...candidate,
      label,
      reasoning: `${candidate.reasoning} ${t('shape.labelCropReasoning')}`
    };
  }));
}

async function recognizeShapeLabel(
  inputImage: string,
  bbox: GeometryCandidate['bbox']
): Promise<string | undefined> {
  const crop = await createShapeLabelCrop(inputImage, bbox);
  const lines = await runTesseractLoose(crop);
  const labelLines = lines
    .map((line) => ({
      text: normalizeShapeLabelLine(line.text),
      confidence: line.confidence
    }))
    .filter((line) => line.text.length > 1)
    .filter((line) => line.confidence >= 35)
    .filter((line) => isUsefulShapeLabel(line.text));

  return mergeShapeLabelLines(labelLines);
}

async function createShapeLabelCrop(
  inputImage: string,
  bbox: GeometryCandidate['bbox']
): Promise<Buffer> {
  const metadata = await sharp(inputImage).metadata();
  const imageWidth = metadata.width ?? bbox.x + bbox.width;
  const imageHeight = metadata.height ?? bbox.y + bbox.height;
  const paddingX = Math.max(6, Math.round(bbox.width * 0.06));
  const paddingY = Math.max(6, Math.round(bbox.height * 0.08));
  const left = Math.max(0, bbox.x + paddingX);
  const top = Math.max(0, bbox.y + paddingY);
  const right = Math.min(imageWidth, bbox.x + bbox.width - paddingX);
  const bottom = Math.min(imageHeight, bbox.y + bbox.height - paddingY);

  return sharp(inputImage)
    .extract({
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top)
    })
    .resize({ width: 1400, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

function mergeShapeLabelLines(
  lines: Array<{ text: string; confidence: number }>
): string | undefined {
  const filtered = lines
    .map((line) => line.text)
    .filter((line, index, all) => !all.some((other, otherIndex) =>
      index !== otherIndex && shapeLabelKey(other).includes(shapeLabelKey(line)) && other.length > line.length
    ));
  if (filtered.length === 0) {
    return undefined;
  }

  return normalizeKnownShapeLabelOcr(filtered.join(' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKnownShapeLabelOcr(value: string): string {
  return value
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeShapeLabelLine(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsefulShapeLabel(value: string): boolean {
  if (value.length < 3 || !/\p{L}/u.test(value)) {
    return false;
  }
  const normalized = shapeLabelKey(value);
  const tokens = normalized.split(' ').filter(Boolean);
  if (/^(op|o|p|l|i|caminho|feliz|alternativo)$/.test(normalized)) {
    return false;
  }
  if (isFlowLegendText(normalized)) {
    return false;
  }
  if (tokens.length > 10 || !tokens.some((token) => token.length >= 3)) {
    return false;
  }
  if (tokens.every((token) => NON_LABEL_TOKENS.has(token))) {
    return false;
  }
  return true;
}

const NON_LABEL_TOKENS = new Set([
  'a', 'an', 'and', 'as', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'in', 'na', 'nas', 'no', 'nos',
  'o', 'of', 'on', 'op', 'or', 'p', 'para', 'por', 'the', 'to'
]);

function isFlowLegendText(value: string): boolean {
  return /caminho\s+(feliz|alternativo|principal)|fluxo\s+(principal|alternativo)|happy\s+path|alternate\s+path/i
    .test(value.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

function shapeLabelKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mergeOverlappingGeometryCandidates(candidates: GeometryCandidate[]): GeometryCandidate[] {
  const sorted = [...candidates].sort((left, right) => geometryArea(right.bbox) - geometryArea(left.bbox));
  const merged: GeometryCandidate[] = [];

  for (const candidate of sorted) {
    const existingIndex = merged.findIndex((existing) => shouldMergeGeometry(existing.bbox, candidate.bbox));
    if (existingIndex === -1) {
      merged.push(candidate);
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      bbox: unionBbox(existing.bbox, candidate.bbox),
      confidence: Math.max(existing.confidence, candidate.confidence),
      reasoning: `${existing.reasoning} ${t('shape.mergedReasoning', { id: candidate.id })}`
    };
  }

  return merged.sort((left, right) => {
    if (Math.abs(left.bbox.y - right.bbox.y) > 20) return left.bbox.y - right.bbox.y;
    return left.bbox.x - right.bbox.x;
  });
}

function reindexGeometryCandidates(candidates: GeometryCandidate[]): GeometryCandidate[] {
  return candidates.map((candidate, index) => ({
    ...candidate,
    id: `shape_${index + 1}`
  }));
}

function shouldMergeGeometry(
  left: GeometryCandidate['bbox'],
  right: GeometryCandidate['bbox']
): boolean {
  const leftArea = geometryArea(left);
  const rightArea = geometryArea(right);
  const sizeRatio = Math.max(leftArea, rightArea) / Math.max(1, Math.min(leftArea, rightArea));
  if (sizeRatio > 2.5) {
    return false;
  }
  const intersection = intersectionArea(left, right);
  if (intersection === 0) {
    return false;
  }
  const smallerArea = Math.min(leftArea, rightArea);
  const unionArea = leftArea + rightArea - intersection;
  return intersection / smallerArea >= 0.65 || intersection / unionArea >= 0.45;
}

function unionBbox(
  left: GeometryCandidate['bbox'],
  right: GeometryCandidate['bbox']
): GeometryCandidate['bbox'] {
  const minX = Math.min(left.x, right.x);
  const minY = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function intersectionArea(
  left: GeometryCandidate['bbox'],
  right: GeometryCandidate['bbox']
): number {
  const minX = Math.max(left.x, right.x);
  const minY = Math.max(left.y, right.y);
  const maxX = Math.min(left.x + left.width, right.x + right.width);
  const maxY = Math.min(left.y + left.height, right.y + right.height);
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
}

function geometryArea(bbox: GeometryCandidate['bbox']): number {
  return bbox.width * bbox.height;
}

function connectedComponents(
  data: Buffer,
  width: number,
  height: number,
  predicate: (red: number, green: number, blue: number, alpha: number) => boolean
): Component[] {
  const visited = new Uint8Array(width * height);
  const components: Component[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (visited[start]) continue;
      visited[start] = 1;
      const offset = start * 4;
      if (!predicate(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) continue;

      const queue = [start];
      let cursor = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let pixelCount = 0;

      while (cursor < queue.length) {
        const current = queue[cursor];
        cursor += 1;
        const currentX = current % width;
        const currentY = Math.floor(current / width);
        pixelCount += 1;
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        for (const next of [current - 1, current + 1, current - width, current + width]) {
          if (next < 0 || next >= visited.length || visited[next]) continue;
          const nextX = next % width;
          if (Math.abs(nextX - currentX) > 1) continue;
          const nextOffset = next * 4;
          visited[next] = 1;
          if (predicate(data[nextOffset], data[nextOffset + 1], data[nextOffset + 2], data[nextOffset + 3])) {
            queue.push(next);
          }
        }
      }

      components.push({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        pixelCount
      });
    }
  }

  return components;
}

function groupDashedSegments(components: Component[]): Array<{ bbox: { x: number; y: number; width: number; height: number } }> {
  const small = components.filter((component) =>
    component.width >= 8 && component.width <= 45 && component.height <= 14 && component.pixelCount >= 8
  );
  const groups: Array<{ bbox: { x: number; y: number; width: number; height: number } }> = [];
  const used = new Set<number>();

  for (let index = 0; index < small.length; index += 1) {
    if (used.has(index)) continue;
    const seed = small[index];
    const aligned = small
      .map((component, componentIndex) => ({ component, componentIndex }))
      .filter(({ component, componentIndex }) =>
        !used.has(componentIndex)
        && Math.abs(component.y - seed.y) <= 8
        && Math.abs(component.height - seed.height) <= 8
      )
      .sort((left, right) => left.component.x - right.component.x);
    if (aligned.length < 3) continue;
    aligned.forEach(({ componentIndex }) => used.add(componentIndex));
    const minX = Math.min(...aligned.map(({ component }) => component.x));
    const minY = Math.min(...aligned.map(({ component }) => component.y));
    const maxX = Math.max(...aligned.map(({ component }) => component.x + component.width));
    const maxY = Math.max(...aligned.map(({ component }) => component.y + component.height));
    groups.push({ bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } });
  }

  return groups;
}

function rectangleConfidence(component: Component): number {
  const fillRatio = component.pixelCount / Math.max(1, component.width * component.height);
  if (fillRatio > 0.15) return 0.68;
  return 0.52;
}

function isRedPixel(red: number, green: number, blue: number): boolean {
  return red > 120 && red > green * 1.45 && red > blue * 1.45 && green < 160 && blue < 160;
}

function isBluePixel(red: number, green: number, blue: number): boolean {
  return blue > 120 && blue > red * 1.25 && blue > green * 1.1 && red < 130;
}

function isDarkPixel(red: number, green: number, blue: number): boolean {
  return red < 95 && green < 95 && blue < 95;
}

function isNearWhite(red: number, green: number, blue: number): boolean {
  return red > 235 && green > 235 && blue > 235;
}

function normalizeOcrLine(value: string): string {
  return value
    .replace(/\s*([._-])\s*/g, '$1')
    .replace(/[^A-Za-z0-9._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeColoredLabelLine(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}._\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeUsefulLabel(value: string): boolean {
  if (value.length < 3) {
    return false;
  }
  if (!/\p{L}/u.test(value)) {
    return false;
  }
  if (/^(op|o|p|l|i)$/i.test(value)) {
    return false;
  }
  return true;
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
