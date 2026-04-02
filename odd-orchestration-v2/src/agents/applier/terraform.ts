import { spawn } from 'node:child_process';
import path from 'node:path';
import { Logger } from '../../shared/logger.js';
import { ObservabilityProvider } from '../../shared/provider.js';

const logger = new Logger('applier-terraform');

export async function runTerraform(dir: string, dryRun: boolean, provider: ObservabilityProvider = 'datadog'): Promise<string[]> {
  const commands = [
    ['terraform', ['init', '-input=false']],
    ['terraform', ['apply', '-auto-approve', '-input=false']]
  ] as const;

  const executed: string[] = [];
  for (const [command, args] of commands) {
    executed.push(`${command} ${args.join(' ')}`);
    logger.info('Comando terraform preparado', {
      command,
      args: args.join(' '),
      cwd: path.resolve(dir),
      dryRun
    });
    if (dryRun) {
      continue;
    }

    await exec(command, args, dir, terraformEnv(provider));
  }

  return executed;
}

function terraformEnv(provider: ObservabilityProvider): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (provider === 'datadog') {
    const apiKey = env.DD_API_KEY;
    const appKey = env.DD_APP_KEY;
    const apiUrl = env.DD_API_BASE_URL ?? (env.DD_SITE ? `https://api.${env.DD_SITE}` : undefined);

    if (apiKey) {
      env.TF_VAR_datadog_api_key = apiKey;
    }
    if (appKey) {
      env.TF_VAR_datadog_app_key = appKey;
    }
    if (apiUrl) {
      env.TF_VAR_datadog_api_url = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
    }

    logger.debug('Ambiente terraform resolvido', {
      provider,
      hasDatadogApiKey: Boolean(apiKey),
      hasDatadogAppKey: Boolean(appKey),
      datadogApiUrl: env.TF_VAR_datadog_api_url
    });
    return env;
  }

  logger.debug('Ambiente terraform resolvido', {
    provider,
    hasDynatraceEnvUrl: Boolean(env.DYNATRACE_ENV_URL),
    hasDynatraceApiToken: Boolean(env.DYNATRACE_API_TOKEN),
    hasDynatracePlatformToken: Boolean(env.DYNATRACE_PLATFORM_TOKEN)
  });

  return env;
}

function exec(command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('Executando comando terraform', {
      command,
      args: args.join(' '),
      cwd: path.resolve(cwd)
    });
    const child = spawn(command, [...args], {
      cwd: path.resolve(cwd),
      stdio: ['ignore', 'pipe', 'pipe'],
      env
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        logger.info('Comando terraform concluído', {
          command,
          args: args.join(' ')
        });
        resolve();
        return;
      }

      logger.error('Comando terraform falhou', {
        command,
        args: args.join(' '),
        exitCode: code ?? 'null',
        stderr: tail(stderr),
        stdout: tail(stdout)
      });
      reject(new Error([
        `Falha ao executar ${command} ${args.join(' ')}. Exit code: ${code ?? 'null'}.`,
        stderr.trim() !== '' ? `stderr: ${tail(stderr)}` : '',
        stdout.trim() !== '' ? `stdout: ${tail(stdout)}` : ''
      ].filter(Boolean).join(' ')));
    });

    child.on('error', (error) => {
      logger.error('Erro de spawn no terraform', {
        command,
        args: args.join(' '),
        error: error.message
      });
      reject(error);
    });
  });
}

function tail(value: string, limit = 1200): string {
  const normalized = value.trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return normalized.slice(normalized.length - limit);
}
