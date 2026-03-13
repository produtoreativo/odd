import { spawn } from 'node:child_process';

export async function runTerraform(dir: string, dryRun: boolean): Promise<string[]> {

  const apiKey = process.env.DD_API_KEY;
  const appKey = process.env.DD_APP_KEY;

  const commands = [
    ['terraform', 
      ['apply', 
        '-auto-approve', 
        '-var',
        `datadog_api_key=${apiKey}`,
        '-var',
        `datadog_app_key=${appKey}`
      ]
    ]
  ] as const;

// terraform apply -auto-approve -var datadog_api_key=$DD_API_KEY -var datadog_app_key=$DD_APP_KEY

  const executed: string[] = [];
  for (const [cmd, args] of commands) {
    executed.push(`${cmd} ${args.join(' ')}`);
    if (dryRun) {
      continue;
    }
    await exec(cmd, args, dir);
  }
  return executed;
}

function exec(command: string, args: readonly string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, stdio: 'inherit' });
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
