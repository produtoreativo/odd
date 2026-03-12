import path from 'node:path';
import { parseArgs, requireStringArg } from '../../shared/cli.js';
import { writeJsonFile } from '../../shared/fs.js';
import { readEventStormingFile } from '../../shared/spreadsheet.js';
import { buildDashboardPlan } from './buildPlan.js';
import { buildDatadogDashboardTerraform } from './datadogTf.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const input = requireStringArg(args, 'input');
  const dashboardTitle = requireStringArg(args, 'dashboard-title');
  const outputDir = typeof args.output === 'string' ? args.output : './generated';
  const terraformDir = typeof args['terraform-dir'] === 'string' ? args['terraform-dir'] : './terraform';

  const rows = await readEventStormingFile(input);
  const plan = await buildDashboardPlan(rows, dashboardTitle);
  const terraformJson = buildDatadogDashboardTerraform(plan);

  await writeJsonFile(path.join(outputDir, 'plan.json'), plan);
  await writeJsonFile(path.join(outputDir, 'custom-events.json'), plan.customEvents);
  await writeJsonFile(path.join(terraformDir, 'generated', 'dashboard.auto.tf.json'), terraformJson);

  console.log(`Planner finalizado. Eventos: ${rows.length}`);
  console.log(`Plan: ${path.join(outputDir, 'plan.json')}`);
  console.log(`Custom events: ${path.join(outputDir, 'custom-events.json')}`);
  console.log(`Terraform: ${path.join(terraformDir, 'generated', 'dashboard.auto.tf.json')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
