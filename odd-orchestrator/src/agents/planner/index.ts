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

function buildRunId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function main(): Promise<void> {
  loadDotEnv();

  const args = parseArgs(process.argv.slice(2));
  const input = requireStringArg(args, 'input');
  const dashboardTitle = requireStringArg(args, 'dashboard-title');
  const baseOutput = typeof args.output === 'string' ? args.output : './generated';
  const provider = parseProvider(args.provider);

  const terraformDir = path.join(provider === 'datadog' ? './terraform' : './terraform-dynatrace');

  const inputName = path.basename(input, path.extname(input));
  const runId = buildRunId();
  const outputDir = path.join(baseOutput, `${inputName}_${runId}`);

  const plannerLlm = new Ollama(Model.Qwen25Coder);

  const rows = await readEventStormingFile(input);
  const categorized = await categorizeEvents(plannerLlm, rows);
  const plan = await buildDashboardPlan(plannerLlm, categorized, dashboardTitle);
  const terraformJson = provider === 'datadog'
    ? await buildDatadogDashboardTerraform(plan)
    : await buildDynatraceDashboardTerraform(plan);

  await writeJsonFile(path.join(outputDir, 'plan.json'), plan);
  await writeJsonFile(path.join(outputDir, 'custom-events.json'), plan.customEvents);

  await writeJsonFile(path.join(terraformDir, 'generated', `${inputName}-dashboard.auto.tf.json`), terraformJson);

  console.log(`Planner finalizado. Provider: ${provider}. Eventos: ${rows.length}`);
  console.log(`Output: ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
