import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { checkPageHtml } from '../src/checks/page-html.ts';
import { withFakeR2 } from './fake-r2.ts';
import { assertNoR2Leaks } from './leak-check.ts';
import { exited, nextEnv, spawnNext, WEB, withServer } from './next-server.ts';

function requireCheck(condition: boolean, reason: string): asserts condition {
  if (!condition) throw new Error(`published: ${reason}`);
}

function checkOutput(sentinels: string[]): void {
  const scan = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.isFile()) assertNoR2Leaks(readFileSync(file, 'utf8'), sentinels, 'build output', false);
    }
  };
  scan(path.join(WEB, '.next'));
}

/** A second, published-mode build proves that credentials are read only at request time. */
export async function checkPublishedBuild(): Promise<void> {
  await withFakeR2(async (fake) => {
    const build = spawnNext(['build'], nextEnv(fake.env), false);
    requireCheck(await exited(build) === 0, 'published-mode build failed');
    requireCheck(fake.requests.length === 0, 'build read R2');
    checkOutput(fake.sentinels);
  });
  console.log('check:build · published build: zero R2 reads; no private configuration in build output');
}

export async function checkPublishedPage(): Promise<void> {
  await withFakeR2(async (fake) => {
    await withServer(fake.env, async (port) => {
      const url = `http://127.0.0.1:${port}/`;
      const htmlResponse = await fetch(url);
      const html = await htmlResponse.text();
      requireCheck(htmlResponse.status === 200 && htmlResponse.headers.get('cache-control')?.includes('no-store') === true, 'HTML status/cache policy');
      requireCheck(html.includes('data-page-state="data"'), 'verified publication did not render data');
      requireCheck(checkPageHtml(html, { overview: fake.overview, demoState: null }).length === 0, 'HTML differs from published overview');
      assertNoR2Leaks(html, fake.sentinels, 'published HTML and inline RSC');
      requireCheck(JSON.stringify(fake.requests) === JSON.stringify(fake.expectedKeys), 'expected exactly one pointer, manifest and document GET per HTML render');
      const rscResponse = await fetch(url, { headers: { RSC: '1' } });
      const rsc = await rscResponse.text();
      requireCheck(rscResponse.status === 200 && rscResponse.headers.get('content-type')?.includes('text/x-component') === true, 'separate RSC response was not exercised');
      requireCheck(rsc.includes('data-page-state') && rsc.includes('data'), 'RSC did not contain the data page');
      assertNoR2Leaks(rsc, fake.sentinels, 'published RSC response');
      requireCheck(JSON.stringify(fake.requests) === JSON.stringify([...fake.expectedKeys, ...fake.expectedKeys]), 'RSC render did not use exactly three new pinned reads');
      checkOutput(fake.sentinels);
    });
  });
  await withServer({ API_MODE: 'published' }, async (port) => {
    requireCheck((await fetch(`http://127.0.0.1:${port}/`)).status === 500, 'missing R2 config must fail loudly');
  });
  console.log('check:build · fake R2: data HTML/RSC, one pointer per render, no private endpoint/bucket/keys/secret/signed URLs; missing config: 500');
}
