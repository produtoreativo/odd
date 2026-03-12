import { spawn } from 'node:child_process';

export async function runTerraform(dir: string, dryRun: boolean): Promise<string[]> {
  const commands = [
    ['terraform', ['init']],
    ['terraform', ['apply', '-auto-approve']]
  ] as const;

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
