// Build and no-JS HTML check of the web page. Run with
// `pnpm --filter @app/web check:build`, locally and in the CI job `web`:
//
// 1. `next build` with API_MODE=live and API_URL pointing at a trap server: the build succeeds, the trap
//    receives no connection (the build does not call the API), `/` is not prerendered, and Next leaves
//    tsconfig.json as it is.
// 2. The client assets (.next/static) contain neither the API_URL sentinel nor the API path, the mock
//    catalog or the contracts runtime; the sentinel is nowhere in the build output. Fonts are
//    self-hosted: no Google font host in the assets or in any page's HTML, and a .woff2 is shipped.
// 3. `next start` per MOCK_STATE: a plain HTTP GET (no JS) returns the page with its figures, status,
//    feed and SVG charts, or the empty / unavailable page, never cached.
// 4. API_MODE=live against a stub API: data → stub down → unavailable → stub up → data, one overview
//    request per page request.
// 5. A bad API_MODE or SITE_URL is a server error, not a silent fallback to mock data.
// 6. `/robots.txt` answers 200 and disallows nothing.
// 7. The canonical link resolves to the page root when SITE_URL is set and is absent when it is
//    not; the tab title names the product (with the header h1 in checkPageHtml).

import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createMockClient, type MockState, type Overview } from '@app/contracts';
import { checkPageHtml } from '../src/checks/page-html.ts';
import { mockStates } from '../src/server/config.ts';
import { texts } from '../src/texts.ts';
import { exited, freePort, nextEnv, spawnNext, WEB, withServer } from './next-server.ts';
import { checkLongHistory } from './leak-check.ts';
import { checkPublishedBuild, checkPublishedPage } from './published-check.ts';

const NEXT_DIR = path.join(WEB, '.next');

// Strings that must not reach the browser: the API path, the mock catalog (synthetic transaction
// hashes spell "synthetic" in hex), the mock client and the contracts schemas.
const CLIENT_FORBIDDEN = ['/v1/supply', '0x73796e746865746963', 'mock_query_unsupported', 'Mock catalog could not be loaded', 'Expected a decimal string in canonical form', 'AWS4-HMAC-SHA256', 'X-Amz-Algorithm'];

// Fonts are self-hosted (@fontsource): neither the build nor the browser may reach a font CDN.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

class CheckError extends Error {}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new CheckError(message);
}

const log = (message: string) => console.log(`check:build · ${message}`);

interface Listening {
  port: number;
  connections: number;
  close(): Promise<void>;
}

function listen(port: number, handler: http.RequestListener): Promise<Listening> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    const state: Listening = {
      port,
      connections: 0,
      close: () => new Promise((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
    };
    server.on('connection', () => {
      state.connections += 1;
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(state));
  });
}

/** The icon the page links (`<link rel="icon">`) answers 200 with an image: no 404 for a favicon. */
async function expectIcon(port: number, html: string, label: string): Promise<void> {
  const link = /<link\b[^>]*\brel="icon"[^>]*>/.exec(html)?.[0];
  assert(link !== undefined, `${label}: no <link rel="icon"> in the page`);
  const href = /\bhref="([^"]+)"/.exec(link)?.[1];
  assert(href !== undefined, `${label}: the icon link has no href`);
  const response = await fetch(new URL(href.replaceAll('&amp;', '&'), `http://127.0.0.1:${port}/`));
  const type = response.headers.get('content-type') ?? '';
  assert(response.status === 200 && type.startsWith('image/'), `${label}: icon ${href} answered ${response.status} ${type}`);
  await response.arrayBuffer();
}

async function getPage(port: number): Promise<{ status: number; cacheControl: string; html: string }> {
  const response = await fetch(`http://127.0.0.1:${port}/`, { headers: { accept: 'text/html' } });
  return { status: response.status, cacheControl: response.headers.get('cache-control') ?? '', html: await response.text() };
}

function expectPage(page: { status: number; cacheControl: string; html: string }, overview: Overview | null, demoState: string | null, label: string) {
  assert(page.status === 200, `${label}: HTTP ${page.status}`);
  assert(/no-store/.test(page.cacheControl), `${label}: the page must not be cacheable (cache-control: ${page.cacheControl})`);
  for (const host of FONT_HOSTS) assert(!page.html.includes(host), `${label}: the page HTML references the font host ${host}`);
  // The tab title names the product (the header h1 is checked in checkPageHtml).
  const title = /<title>([\s\S]*?)<\/title>/.exec(page.html)?.[1] ?? '';
  assert(title.includes(texts.productName), `${label}: the tab title does not name the product: ${title}`);
  const problems = checkPageHtml(page.html, { overview, demoState });
  assert(problems.length === 0, `${label}:\n  ${problems.join('\n  ')}`);
}

function filesUnder(dir: string, skip: (name: string) => boolean = () => false): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (skip(entry.name)) return [];
    const full = path.join(dir, entry.name);
    // Next externalizes server dependencies as directory symlinks; they are not emitted assets.
    return entry.isDirectory() ? filesUnder(full, skip) : entry.isFile() ? [full] : [];
  });
}

const containing = (files: readonly string[], needle: string): string[] =>
  files.filter((file) => readFileSync(file).includes(needle));

async function expectedOverview(state: MockState): Promise<Overview | null> {
  try {
    return await createMockClient(state).overview();
  } catch {
    return null; // the unavailable state
  }
}

// 1. The build does not call the API and leaves `/` dynamic.
async function checkBuild(): Promise<string> {
  rmSync(NEXT_DIR, { recursive: true, force: true });
  const sentinel = `sentinel-${randomUUID()}`;
  // A listening trap rather than a closed port: a request to a closed port would only produce the
  // unavailable page, and a build that called the API would still pass.
  const trap = await listen(await freePort(), (_request, response) => {
    response.writeHead(500).end();
  });
  const apiUrl = `http://127.0.0.1:${trap.port}/${sentinel}`;
  const tsconfig = readFileSync(path.join(WEB, 'tsconfig.json'), 'utf8');
  try {
    log(`next build with API_MODE=live, API_URL=${apiUrl}`);
    const build = spawnNext(['build'], nextEnv({ API_MODE: 'live', API_URL: apiUrl }), false);
    const code = await exited(build);
    assert(code === 0, `next build exited with ${String(code)}`);
    assert(trap.connections === 0, `the build connected to the API ${trap.connections} time(s)`);
  } finally {
    await trap.close();
  }
  const manifest = JSON.parse(readFileSync(path.join(NEXT_DIR, 'prerender-manifest.json'), 'utf8')) as { routes: Record<string, unknown> };
  assert(!('/' in manifest.routes), '/ is prerendered; it must be dynamic');
  assert(!existsSync(path.join(NEXT_DIR, 'server', 'app', 'index.html')), '/ has static HTML; it must be dynamic');
  assert(readFileSync(path.join(WEB, 'tsconfig.json'), 'utf8') === tsconfig, 'next build rewrote tsconfig.json');
  log('build: no API connection, / is dynamic, tsconfig.json unchanged');
  return sentinel;
}

// 2. Nothing of the API, the mock catalog or the contracts runtime reaches the client assets.
function checkAssets(sentinel: string): void {
  const client = filesUnder(path.join(NEXT_DIR, 'static'));
  assert(client.length > 0, 'no client assets in .next/static');
  for (const needle of [sentinel, ...CLIENT_FORBIDDEN]) {
    const leaks = containing(client, needle);
    assert(leaks.length === 0, `client assets contain "${needle}": ${leaks.map((file) => path.relative(WEB, file)).join(', ')}`);
  }
  // Positive control: the server bundle does contain them, so the search above can find them.
  const server = filesUnder(path.join(NEXT_DIR, 'server'));
  for (const needle of CLIENT_FORBIDDEN.slice(0, 2)) {
    assert(containing(server, needle).length > 0, `control: the server bundle should contain "${needle}"`);
  }
  for (const host of FONT_HOSTS) {
    const leaks = containing(client, host);
    assert(leaks.length === 0, `client assets reference the font host ${host}: ${leaks.map((file) => path.relative(WEB, file)).join(', ')}`);
  }
  assert(client.some((file) => file.endsWith('.woff2')), 'no self-hosted .woff2 font in .next/static');
  const anywhere = containing(filesUnder(NEXT_DIR, (name) => name === 'cache'), sentinel);
  assert(anywhere.length === 0, `the API_URL sentinel is in the build output: ${anywhere.map((file) => path.relative(WEB, file)).join(', ')}`);
  log(`client assets: ${client.length} files without the API URL, API path, mock catalog, contracts runtime or font hosts; fonts are self-hosted`);
}

// 3. Each mock state over plain HTTP.
async function checkMockStates(): Promise<void> {
  for (const state of mockStates) {
    const overview = await expectedOverview(state);
    await withServer({ API_MODE: 'mock', MOCK_STATE: state }, async (port) => {
      const page = await getPage(port);
      if (state === 'long-history') {
        assert(overview !== null, 'long-history overview missing');
        await checkLongHistory(page.html, overview);
        log('long-history source HTML and inline RSC contain no forbidden old daily values; daily/equation/quality controls present');
      }
      expectPage(page, overview, state, `MOCK_STATE=${state}`);
      await expectIcon(port, page.html, `MOCK_STATE=${state}`);
    });
    log(`MOCK_STATE=${state}: ${overview === null ? 'unavailable' : overview.asOf === null ? 'empty' : 'data'} page without JS, icon answers 200`);
  }
}

// 4. Live mode against a stub API that goes down and comes back.
async function checkLive(): Promise<void> {
  const overview = await createMockClient('ok').overview();
  const body = JSON.stringify(overview);
  let requests = 0;
  const served = () => requests;
  const handler: http.RequestListener = (request, response) => {
    if (request.method === 'GET' && request.url?.split('?')[0] === '/v1/supply/overview') {
      requests += 1;
      response.writeHead(200, { 'content-type': 'application/json' }).end(body);
    } else {
      response.writeHead(404).end();
    }
  };
  const stubPort = await freePort();
  let stub = await listen(stubPort, handler);
  try {
    await withServer({ API_MODE: 'live', API_URL: `http://127.0.0.1:${stubPort}` }, async (port) => {
      expectPage(await getPage(port), overview, null, 'live, API up');
      assert(served() === 1, `live: expected one overview request per page, got ${served()}`);
      await stub.close();
      expectPage(await getPage(port), null, null, 'live, API down');
      stub = await listen(stubPort, handler);
      expectPage(await getPage(port), overview, null, 'live, API back');
      expectPage(await getPage(port), overview, null, 'live, API back, again');
      assert(served() === 3, `live: expected one overview request per page, got ${served()} for three pages with the API up`);
    });
  } finally {
    await stub.close();
  }
  log('live: data → unavailable → data, one overview request per page');
}

// 5. A configuration error is loud.
async function checkBadConfig(): Promise<void> {
  await withServer({ API_MODE: 'bogus' }, async (port) => {
    const page = await getPage(port);
    assert(page.status === 500, `API_MODE=bogus: expected HTTP 500, got ${page.status}`);
  });
  await withServer({ API_MODE: 'mock', SITE_URL: 'bogus' }, async (port) => {
    const page = await getPage(port);
    assert(page.status === 500, `SITE_URL=bogus: expected HTTP 500, got ${page.status}`);
  });
  log('API_MODE=bogus: HTTP 500; SITE_URL=bogus: HTTP 500');
}

/** The href of the page's link with this rel, whatever the attribute order is. */
function linkHref(html: string, rel: string): string | undefined {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!new RegExp(`\\brel="${rel}"`).test(tag)) continue;
    const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
    if (href !== undefined) return href;
  }
  return undefined;
}

// 6. /robots.txt answers 200 and disallows nothing.
async function checkRobots(): Promise<void> {
  await withServer({ API_MODE: 'mock', MOCK_STATE: 'ok' }, async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/robots.txt`);
    const body = await response.text();
    assert(response.status === 200, `/robots.txt: expected HTTP 200, got ${response.status}`);
    assert(/^user-agent:\s*\*/im.test(body), '/robots.txt: expected a User-agent: * rule');
    const disallowed = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^disallow:/i.test(line) && !/^disallow:\s*$/.test(line));
    assert(disallowed.length === 0, `/robots.txt disallows the page: ${disallowed.join(', ')}`);
  });
  log('/robots.txt: 200, a User-agent: * rule, nothing disallowed');
}

// 7. The canonical link follows SITE_URL: with a base address it resolves to the page root,
// without one the page carries no canonical link.
async function checkCanonical(): Promise<void> {
  await withServer({ API_MODE: 'mock', MOCK_STATE: 'ok', SITE_URL: 'https://example.com' }, async (port) => {
    const page = await getPage(port);
    const href = linkHref(page.html, 'canonical');
    assert(href !== undefined, 'SITE_URL set: expected a canonical link');
    assert(new URL(href).href === 'https://example.com/', `SITE_URL set: the canonical link resolves to ${href}, not the page root`);
  });
  await withServer({ API_MODE: 'mock', MOCK_STATE: 'ok' }, async (port) => {
    const page = await getPage(port);
    assert(linkHref(page.html, 'canonical') === undefined, 'SITE_URL unset: the page must carry no canonical link');
  });
  log('canonical: with SITE_URL it resolves to the page root, without it there is none');
}

try {
  const sentinel = await checkBuild();
  checkAssets(sentinel);
  await checkPublishedBuild();
  checkAssets(sentinel);
  await checkPublishedPage();
  await checkMockStates();
  await checkLive();
  await checkBadConfig();
  await checkRobots();
  await checkCanonical();
  log('ok');
} catch (error) {
  console.error(`check:build · FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
