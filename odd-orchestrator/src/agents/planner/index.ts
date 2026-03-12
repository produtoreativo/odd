import { copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { ensureDir, writeJsonFile } from '../../shared/fs.js';
import { readEventStormingFile } from '../../shared/spreadsheet.js';
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

  const inputName = path.basename(input, path.extname(input));
  const runId = buildRunId();
  const outputDir = path.join(baseOutput, `${inputName}_${runId}`);

  const rows = await readEventStormingFile(input);
  const plan = await buildDashboardPlan(rows, dashboardTitle);
  const terraformJson = await buildDatadogDashboardTerraform(plan);

  await writeJsonFile(path.join(outputDir, 'plan.json'), plan);
  await writeJsonFile(path.join(outputDir, 'custom-events.json'), plan.customEvents);
  await writeJsonFile(path.join(outputDir, 'terraform', 'dashboard.auto.tf.json'), terraformJson);

  const commonTfDir = path.resolve('terraform', 'common');
  const tfOutputDir = path.join(outputDir, 'terraform');
  await ensureDir(tfOutputDir);
  const commonFiles = await readdir(commonTfDir);
  await Promise.all(commonFiles.map(f => copyFile(path.join(commonTfDir, f), path.join(tfOutputDir, f))));

  console.log(`Planner finalizado. Eventos: ${rows.length}`);
  console.log(`Output: ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
