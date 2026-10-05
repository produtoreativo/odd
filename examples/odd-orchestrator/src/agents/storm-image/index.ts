import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import xlsx from 'xlsx';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { loadDotEnv } from '../../shared/env.js';
import { ensureDir, writeJsonFile } from '../../shared/fs.js';

const execFileAsync = promisify(execFile);

type RecognizedFlow = {
  name: string;
  description: string;
  stages: string[];
  actors: string[];
  services: string[];
  confidence: number;
};

type RecognizedRow = {
  ordem: number;
  event_key: string;
  event_title: string;
  stage: string;
  actor: string;
  service: string;
  tags: string;
  dashboard_widget: 'event_stream' | 'query_value' | 'timeseries' | 'note';
  query_hint: string;
};

type RecognizedStorm = {
  recognizedFlows: RecognizedFlow[];
  rows: RecognizedRow[];
  assumptions: string[];
};

function logStep(step: string, detail?: string): void {
  console.log(`[storm-image] ${step}${detail ? `: ${detail}` : ''}`);
}

async function readPrompt(): Promise<string> {
  const promptPath = path.join(process.cwd(), 'src', 'agents', 'storm-image', 'interpret.prompt.md');
  return readFile(promptPath, 'utf-8');
}

async function prepareImageForVision(imagePath: string): Promise<string> {
  const debugDir = path.join(process.cwd(), 'generated', 'storm-image-debug');
  await ensureDir(debugDir);
  const preparedPath = path.join(debugDir, `${path.basename(imagePath, path.extname(imagePath))}-prepared.jpg`);

  await execFileAsync('/usr/bin/sips', [
    '-s',
    'format',
    'jpeg',
    '--resampleWidth',
    '1024',
    imagePath,
    '--out',
    preparedPath
  ]);

  return preparedPath;
}

function toAsciiSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeRows(rows: RecognizedRow[]): RecognizedRow[] {
  return rows
    .slice()
    .sort((left, right) => left.ordem - right.ordem)
    .map((row, index) => ({
      ordem: index + 1,
      event_key: toAsciiSlug(String(row.event_key).trim()),
      event_title: String(row.event_title).trim(),
      stage: toAsciiSlug(String(row.stage).trim()),
      actor: String(row.actor).trim(),
      service: String(row.service).trim(),
      tags: String(row.tags).trim(),
      dashboard_widget: row.dashboard_widget,
      query_hint: String(row.query_hint).trim()
    }))
    .filter((row) => row.event_key !== '' && row.event_title !== '');
}

async function callOllamaVision(model: string, imagePath: string, prompt: string): Promise<RecognizedStorm> {
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace('://localhost:', '://127.0.0.1:');
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/generate`;
  const preparedImagePath = await prepareImageForVision(imagePath);
  const imageBuffer = await readFile(preparedImagePath);
  const body = {
    model,
    prompt,
    stream: false,
    images: [imageBuffer.toString('base64')],
    options: {
      temperature: 0
    }
  };

  const debugDir = path.join(process.cwd(), 'generated', 'storm-image-debug');
  await ensureDir(debugDir);
  const debugFile = path.join(debugDir, `${path.basename(imagePath, path.extname(imagePath))}-request.json`);
  await writeFile(debugFile, `${JSON.stringify({ ...body, images: ['data:image/jpeg;base64,<omitted>'] }, null, 2)}\n`, 'utf-8');

  logStep('llm', `endpoint=${endpoint} model=${model}`);
  logStep('llm-image', preparedImagePath);
  logStep('llm-debug', debugFile);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Ollama vision retornou ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as { response?: string };
  return parseVisionJson(data.response ?? '{}');
}

function parseVisionJson(raw: string): RecognizedStorm {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  const jsonText = firstBrace >= 0 && lastBrace > firstBrace
    ? candidate.slice(firstBrace, lastBrace + 1)
    : candidate;

  return JSON.parse(jsonText) as RecognizedStorm;
}

function writeWorkbook(rows: RecognizedRow[], outputFile: string): void {
  const worksheetRows = rows.map((row) => ({
    ordem: row.ordem,
    event_key: row.event_key,
    event_title: row.event_title,
    stage: row.stage,
    actor: row.actor,
    service: row.service,
    tags: row.tags,
    dashboard_widget: row.dashboard_widget,
    query_hint: row.query_hint
  }));

  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(worksheetRows);
  xlsx.utils.book_append_sheet(workbook, worksheet, 'event_storming');
  xlsx.writeFile(workbook, outputFile);
}

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const inputImage = path.resolve(requireStringArg(args, 'input-image'));
  const outputDir = path.resolve(requireStringArg(args, 'output-dir'));
  const model = requireStringArg(args, 'model');

  logStep('start', `input_image=${inputImage} output_dir=${outputDir} model=${model}`);
  await ensureDir(outputDir);

  const promptTemplate = await readPrompt();
  const prompt = [
    promptTemplate,
    '',
    `Arquivo de entrada: ${path.basename(inputImage)}`,
    'Analise a imagem inteira e consolide os fluxos reconhecidos.'
  ].join('\n');

  const recognized = await callOllamaVision(model, inputImage, prompt);
  const rows = normalizeRows(recognized.rows);

  if (rows.length === 0) {
    throw new Error('Nenhum evento foi reconhecido na imagem.');
  }

  const jsonOutput = {
    recognizedFlows: recognized.recognizedFlows,
    rows,
    assumptions: recognized.assumptions
  };

  const jsonPath = path.join(outputDir, 'recognized-flows.json');
  const xlsxPath = path.join(outputDir, 'recognized-event-storming.xlsx');

  await writeJsonFile(jsonPath, jsonOutput);
  writeWorkbook(rows, xlsxPath);

  logStep('done', `rows=${rows.length} json=${jsonPath} xlsx=${xlsxPath}`);
}

main().catch((error) => {
  console.error('[storm-image] failed');
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
