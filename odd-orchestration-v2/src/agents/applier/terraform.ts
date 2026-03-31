import { spawn } from 'node:child_process';
import path from 'node:path';
import { Logger } from '../../shared/logger.js';

const logger = new Logger('applier-terraform');

export async function runTerraform(dir: string, dryRun: boolean): Promise<string[]> {
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

    await exec(command, args, dir, terraformEnv());
  }

  return executed;
}

function terraformEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
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
    hasDatadogApiKey: Boolean(apiKey),
    hasDatadogAppKey: Boolean(appKey),
    datadogApiUrl: env.TF_VAR_datadog_api_url
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
      stdio: 'inherit',
      env
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
        exitCode: code ?? 'null'
      });
      reject(new Error(`Falha ao executar ${command} ${args.join(' ')}. Exit code: ${code ?? 'null'}`));
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
