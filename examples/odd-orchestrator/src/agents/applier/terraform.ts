import { spawn } from 'node:child_process';
import { ObservabilityProvider } from '../../shared/provider.js';

export async function runTerraform(dir: string, dryRun: boolean, provider: ObservabilityProvider): Promise<string[]> {
  const commands = [
    ['terraform', ['apply', '-auto-approve']]
  ] as const;

  const executed: string[] = [];
  for (const [cmd, args] of commands) {
    executed.push(`${cmd} ${args.join(' ')}`);
    if (dryRun) {
      continue;
    }
    await exec(cmd, args, dir, terraformEnv(provider));
  }
  return executed;
}

function terraformEnv(provider: ObservabilityProvider): NodeJS.ProcessEnv {
  const env = { ...process.env };

  if (provider === 'datadog') {
    const apiKey = env.DD_API_KEY;
    const appKey = env.DD_APP_KEY;
    if (apiKey) env.TF_VAR_datadog_api_key = apiKey;
    if (appKey) env.TF_VAR_datadog_app_key = appKey;
  }

  if (provider === 'grafana') {
    const grafanaUrl = env.GRAFANA_URL;
    const grafanaAuth = env.GRAFANA_AUTH;
    if (grafanaUrl) env.TF_VAR_grafana_url = grafanaUrl;
    if (grafanaAuth) env.TF_VAR_grafana_auth = grafanaAuth;
  }

  if (provider === 'dynatrace') {
    const envUrl = env.DYNATRACE_ENV_URL ?? env.DYNATRACE_ENVIRONMENT_URL ?? env.DT_ENV_URL ?? env.DT_ENVIRONMENT_URL;
    const apiToken = env.DYNATRACE_API_TOKEN ?? env.DT_API_TOKEN;
    const platformToken = env.DYNATRACE_PLATFORM_TOKEN ?? env.DT_PLATFORM_TOKEN ?? apiToken;

    if (envUrl) {
      env.DYNATRACE_ENV_URL = envUrl;
      env.DYNATRACE_ENVIRONMENT_URL = envUrl;
      env.DT_ENV_URL = envUrl;
      env.DT_ENVIRONMENT_URL = envUrl;
      env.DYNATRACE_ENDPOINT_URL = envUrl;
      env.DT_ENDPOINT_URL = envUrl;
    }

    if (apiToken) {
      env.DYNATRACE_API_TOKEN = apiToken;
      env.DT_API_TOKEN = apiToken;
    }

    if (platformToken) {
      env.DYNATRACE_PLATFORM_TOKEN = platformToken;
      env.DT_PLATFORM_TOKEN = platformToken;
    }
  }

  return env;
}

function exec(command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, stdio: 'inherit', env });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Falha ao executar ${command} ${args.join(' ')}. Exit code: ${code ?? 'null'}`));
    });
    child.on('error', reject);
  });
}
