// Shared by scripts/check-build.ts and scripts/browser-smoke.ts: `next start` of the built page on a free
// port, in its own process group, with a clean page configuration.

import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

export const WEB = path.join(import.meta.dirname, '..');
const NEXT_BIN = path.join(WEB, 'node_modules', 'next', 'dist', 'bin', 'next');
const READY_PROBE = '/__check-build-ready'; // a 404 page: it never calls the API

/** The environment of a Next process: no inherited page configuration, telemetry off. */
export function nextEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
  delete env.API_MODE;
  delete env.API_URL;
  delete env.MOCK_STATE;
  delete env.SITE_URL;
  for (const name of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) delete env[name];
  return { ...env, ...extra };
}

export function spawnNext(args: string[], env: NodeJS.ProcessEnv, quiet: boolean): ChildProcess {
  return spawn(process.execPath, [NEXT_BIN, ...args], {
    cwd: WEB,
    env,
    detached: true, // its own process group, so that stop() reaches every child
    stdio: ['ignore', quiet ? 'ignore' : 'inherit', 'inherit'],
  });
}

export const exited = (child: ChildProcess): Promise<number | null> =>
  new Promise((resolve) => {
    if (child.exitCode !== null) resolve(child.exitCode);
    else child.once('exit', (code) => resolve(code));
  });

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    return;
  }
  await exited(child);
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

async function waitReady(port: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited with ${String(child.exitCode)}`);
    try {
      await fetch(`http://127.0.0.1:${port}${READY_PROBE}`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`next start on port ${port} did not become ready`);
}

export async function withServer<T>(env: Record<string, string>, use: (port: number) => Promise<T>): Promise<T> {
  const port = await freePort();
  const child = spawnNext(['start', '-p', String(port), '-H', '127.0.0.1'], nextEnv(env), true);
  try {
    await waitReady(port, child);
    return await use(port);
  } finally {
    await stop(child);
  }
}
