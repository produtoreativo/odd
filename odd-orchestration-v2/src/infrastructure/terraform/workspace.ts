import path from 'node:path';
import { copyFile, readdir } from 'node:fs/promises';
import { ensureDir, writeJsonFile } from '../../shared/fs.js';
import { ObservabilityProvider } from '../../shared/provider.js';

export function resolveTerraformTemplateDir(provider: ObservabilityProvider): string {
  const dirName = provider === 'dynatrace'
    ? 'terraform-dynatrace'
    : provider === 'grafana'
      ? 'terraform-grafana'
      : 'terraform';

  return path.resolve(process.cwd(), dirName);
}

export async function prepareTerraformWorkspace(provider: ObservabilityProvider, workspaceDir: string): Promise<void> {
  const templateDir = resolveTerraformTemplateDir(provider);
  await ensureDir(workspaceDir);
  await ensureDir(path.join(workspaceDir, 'generated'));

  await copyTemplateRootFiles(templateDir, workspaceDir);
  await copyTemplateGeneratedStaticFiles(path.join(templateDir, 'generated'), path.join(workspaceDir, 'generated'));
}

export async function writeTerraformWorkspaceArtifact(
  workspaceDir: string,
  provider: ObservabilityProvider,
  dashboardKey: string,
  terraformJson: Record<string, unknown>
): Promise<string> {
  const filePath = path.join(workspaceDir, 'generated', `${provider}-${dashboardKey}-dashboard.auto.tf.json`);
  await writeJsonFile(filePath, terraformJson);
  return filePath;
}

async function copyTemplateRootFiles(templateDir: string, workspaceDir: string): Promise<void> {
  const entries = await safeReadDir(templateDir);
  for (const entry of entries) {
    if (entry === 'generated' || entry === '.terraform') {
      continue;
    }

    if (entry === 'terraform.tfstate' || entry === 'terraform.tfstate.backup') {
      continue;
    }

    if (!entry.endsWith('.tf') && !entry.endsWith('.hcl') && !entry.endsWith('.tfvars')) {
      continue;
    }

    await copyFile(path.join(templateDir, entry), path.join(workspaceDir, entry));
  }
}

async function copyTemplateGeneratedStaticFiles(templateGeneratedDir: string, workspaceGeneratedDir: string): Promise<void> {
  const entries = await safeReadDir(templateGeneratedDir);
  for (const entry of entries) {
    if (entry.endsWith('.auto.tf.json')) {
      continue;
    }

    await copyFile(path.join(templateGeneratedDir, entry), path.join(workspaceGeneratedDir, entry));
  }
}

async function safeReadDir(dirPath: string): Promise<string[]> {
  try {
    return await readdir(dirPath);
  } catch {
    return [];
  }
}
