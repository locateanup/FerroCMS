#!/usr/bin/env node
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scaffold } from './scaffold.js';

interface Args {
  name?: string;
  ref: string;
  sourceDir?: string;
  install: boolean;
  git: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { ref: 'main', install: true, git: true };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === '--ref') {
      args.ref = argv[++i] ?? args.ref;
    } else if (arg === '--source-dir') {
      args.sourceDir = argv[++i];
    } else if (arg === '--no-install') {
      args.install = false;
    } else if (arg === '--no-git') {
      args.git = false;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  args.name = positional[0];
  return args;
}

function run(command: string, commandArgs: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${commandArgs.join(' ')} exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.name) {
    console.log('Usage: create-ferrocms <project-directory> [--ref <git-ref>] [--no-install] [--no-git]');
    process.exitCode = 1;
    return;
  }

  const targetDir = path.resolve(process.cwd(), args.name);

  console.log(`Scaffolding a FerroCMS project in ${targetDir} ...`);
  const result = await scaffold({
    targetDir,
    ref: args.ref,
    sourceDir: args.sourceDir,
  });

  if (args.git) {
    try {
      await run('git', ['init', '-q'], result.targetDir);
    } catch {
      console.warn('Could not run `git init` — skipping (is git installed?).');
    }
  }

  if (args.install) {
    console.log('Installing dependencies with pnpm ...');
    try {
      await run('pnpm', ['install'], result.targetDir);
    } catch {
      console.warn('`pnpm install` failed — run it yourself once you have pnpm set up.');
    }
  }

  console.log(`
Created ${result.packageName} in ${result.targetDir}

Next steps:
  cd ${args.name}${args.install ? '' : '\n  pnpm install'}
  cp .env.example apps/api/.dev.vars     # add DATABASE_URL + DATABASE_AUTH_TOKEN + AUTH_SECRET
  pnpm --filter @ferrocms/db db:push     # create tables on your Turso database
  pnpm dev                               # runs the API worker + admin SPA
`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
