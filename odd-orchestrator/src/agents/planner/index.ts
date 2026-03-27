import path from 'node:path';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { loadDotEnv } from '../../shared/env.js';
import { writeJsonFile } from '../../shared/fs.js';
import { parseProvider } from '../../shared/provider.js';
import { readEventStormingFile } from '../../shared/spreadsheet.js';
import { Ollama, Model } from '../../shared/llm/index.js';
import { categorizeEvents } from './categorizeEvents.js';
import { buildDashboardPlan } from './buildPlan.js';
import { buildDatadogDashboardTerraform } from './datadogTf.js';
import { buildDynatraceDashboardTerraform } from './dynatraceTf.js';
import { buildGrafanaDashboardTerraform } from './grafanaTf.js';

function buildRunId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function logStep(step: string, detail?: string): void {
  console.log(`[planner] ${step}${detail ? `: ${detail}` : ''}`);
}

function normalizeOllamaBaseUrl(baseUrl: string): string {
  return baseUrl.replace('://localhost:', '://127.0.0.1:');
}

async function main(): Promise<void> {
  loadDotEnv();

  const args = parseArgs(process.argv.slice(2));
  const input = requireStringArg(args, 'input');
  const dashboardTitle = requireStringArg(args, 'dashboard-title');
  const baseOutput = typeof args.output === 'string' ? args.output : './generated';
  const provider = parseProvider(args.provider);

  const terraformDirMap: Record<string, string> = {
    datadog: './terraform',
    dynatrace: './terraform-dynatrace',
    grafana: './terraform-grafana'
  };
  const terraformDir = path.join(terraformDirMap[provider]);

  const inputName = path.basename(input, path.extname(input));
  const runId = buildRunId();
  const outputDir = path.join(baseOutput, `${inputName}_${runId}`);

  const plannerLlm = new Ollama(Model.Qwen25Coder);

  logStep('start', `provider=${provider} input=${input} output=${outputDir}`);
  logStep('llm', `ollama_base_url=${normalizeOllamaBaseUrl(process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434')} model=${process.env.OLLAMA_MODEL ?? Model.Qwen25Coder}`);

  logStep('read-input');
  const rows = await readEventStormingFile(input);
  logStep('read-input:done', `rows=${rows.length}`);

  logStep('categorize-events');
  const categorized = await categorizeEvents(plannerLlm, rows);
  logStep('categorize-events:done', `problems=${categorized.problems.length} normal=${categorized.normal.length}`);

  logStep('build-dashboard-plan');
  const plan = await buildDashboardPlan(plannerLlm, categorized, dashboardTitle);
  logStep('build-dashboard-plan:done', `bands=${plan.bands.length} customEvents=${plan.customEvents.length}`);

  logStep('build-terraform', `provider=${provider}`);
  const terraformJson = provider === 'datadog'
    ? await buildDatadogDashboardTerraform(plan)
    : provider === 'dynatrace'
    ? await buildDynatraceDashboardTerraform(plan)
    : await buildGrafanaDashboardTerraform(plan);
  logStep('build-terraform:done');

  logStep('write-artifacts');
  await writeJsonFile(path.join(outputDir, 'plan.json'), plan);
  await writeJsonFile(path.join(outputDir, 'custom-events.json'), plan.customEvents);

  await writeJsonFile(path.join(terraformDir, 'generated', `${inputName}-dashboard.auto.tf.json`), terraformJson);
  logStep('write-artifacts:done', `terraform=${path.join(terraformDir, 'generated', `${inputName}-dashboard.auto.tf.json`)}`);

  console.log(`Planner finalizado. Provider: ${provider}. Eventos: ${rows.length}`);
  console.log(`Output: ${outputDir}`);
}

main().catch((error) => {
  console.error('[planner] failed');
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
