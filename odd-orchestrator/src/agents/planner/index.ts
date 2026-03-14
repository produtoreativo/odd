import path from 'node:path';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { writeJsonFile } from '../../shared/fs.js';
import { readEventStormingFile } from '../../shared/spreadsheet.js';
import { Ollama, Model } from '../../shared/llm/index.js';
import { buildDashboardPlan } from './buildPlan.js';
import { buildDatadogDashboardTerraform } from './datadogTf.js';

function buildRunId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const input = requireStringArg(args, 'input');
  const dashboardTitle = requireStringArg(args, 'dashboard-title');
  const baseOutput = typeof args.output === 'string' ? args.output : './generated';

  const terraformDir = path.join('./terraform');

  const inputName = path.basename(input, path.extname(input));
  const runId = buildRunId();
  const outputDir = path.join(baseOutput, `${inputName}_${runId}`);

  const plannerLlm = new Ollama(Model.Qwen25Coder);
  const terraformLlm = new Ollama(Model.Qwen25Coder);

  const rows = await readEventStormingFile(input);
  const plan = await buildDashboardPlan(plannerLlm, rows, dashboardTitle);
  const terraformJson = await buildDatadogDashboardTerraform(terraformLlm, plan);

  await writeJsonFile(path.join(outputDir, 'plan.json'), plan);
  await writeJsonFile(path.join(outputDir, 'custom-events.json'), plan.customEvents);

  await writeJsonFile(path.join(terraformDir, 'generated', runId+'-dashboard.auto.tf.json'), terraformJson);

  console.log(`Planner finalizado. Eventos: ${rows.length}`);
  console.log(`Output: ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
