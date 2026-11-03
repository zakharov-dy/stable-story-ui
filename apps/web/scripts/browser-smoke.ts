// Browser smoke of the web page: no model, and no screenshot unless `--shots` (or BROWSER_SMOKE_SHOTS) asks
// for the catalog (apps/web/browser-test/README.md, docs/design.md). Run with
// `pnpm --filter @app/web browser-smoke` after a build (`pnpm --filter @app/web build`), locally and in the CI
// job `web` after `check:build`, whose build it reuses.
//
// Per mock state and fake-R2 publication: `next start` with API_MODE=mock and MOCK_STATE=<state> on a free port; per width (1440x900,
// 375x812) a fresh headless Chrome context opens the page and the checks of browser-smoke-checks.ts run over
// what it collected: console, network, document status, overflow, fonts, page state and blocks, chart hover,
// tone colors. Sequential; one browser. Exit code 1 when any check of any state and width has a problem.
//
// `--shots <dir>` adds the screenshot catalog after the checks: the full page of every state and width, and on
// the six-chain long-history state sections 03–05 per period (30D, 90D, ALL) with the period switch checked.
// The checks are the same with and without it; a screenshot that cannot be written fails the run with exit 2.
// The browser is the installed Google Chrome through playwright-core (`channel: 'chrome'`): nothing is
// downloaded. BROWSER_SMOKE_CHROME_BIN points to another Chrome binary.

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createMockClient, type MockState, type Overview } from '@app/contracts';
import { chromium, type Browser, type Locator, type Page } from 'playwright-core';
import { mockStates } from '../src/server/config.ts';
import {
  CHECK_IDS,
  VIEWPORTS,
  checkPage,
  createNetworkLog,
  groupProblems,
  sandboxRefusal,
  type ConsoleEntry,
  type DomFacts,
  type HoverFact,
  type PageFacts,
  type PageKind,
  type StateExpectation,
  type ToneFact,
} from './browser-smoke-checks.ts';
import { WEB, withServer } from './next-server.ts';
import { checkLaunchInteractions } from './browser-smoke-launch.ts';
import { withFakeR2 } from './fake-r2.ts';
import { assertNoR2Leaks } from './leak-check.ts';

const SETTLE_MS = 10_000; // bound of the font and idle waits
const HOVER_MS = 5_000; // bound of the wait for one tooltip (it doubles as the hydration wait)

const log = (message: string) => console.log(`browser-smoke · ${message}`);

class UsageError extends Error {}

interface Options {
  states: string[];
  viewports: typeof VIEWPORTS[number][];
  live: boolean;
  apiUrl: string | null;
  shots: string | null;
}

/** The default catalog folder: gitignored, outside version control by design (docs/design.md). */
const SHOTS_DEFAULT = path.join(WEB, '.shots');

/**
 * `--shots <dir>` wins; otherwise `BROWSER_SMOKE_SHOTS` decides: `0` and `false` switch the catalog
 * off, `1` and `true` take the default folder, any other value is the folder.
 */
function resolveShots(flag: string | undefined, env: string | undefined): string | null {
  if (flag !== undefined) return flag;
  if (env === undefined || env === '' || env === '0' || env === 'false') return null;
  return env === '1' || env === 'true' ? SHOTS_DEFAULT : env;
}

function parseOptions(argv: string[]): Options {
  const { values } = parseArgs({
    args: argv,
    options: {
      states: { type: 'string' },
      viewports: { type: 'string' },
      live: { type: 'boolean', default: false },
      'api-url': { type: 'string' },
      shots: { type: 'string' },
    },
    strict: true,
  });
  const live = values.live;
  const apiUrl = values['api-url'] ?? null;
  if (live !== (apiUrl !== null)) throw new UsageError('--live and --api-url <url> go together');
  const states = live ? ['live'] : values.states === undefined ? [...mockStates, 'published'] : values.states.split(',');
  for (const state of states) {
    if (!live && state !== 'published' && !(mockStates as readonly string[]).includes(state)) throw new UsageError(`unknown state "${state}"; states: ${[...mockStates, 'published'].join(', ')}`);
  }
  if (live && values.states !== undefined) throw new UsageError('--states does not apply to --live');
  const wanted = values.viewports === undefined ? VIEWPORTS.map((viewport) => `${viewport.width}x${viewport.height}`) : values.viewports.split(',');
  const viewports = wanted.map((name) => {
    const viewport = VIEWPORTS.find((candidate) => `${candidate.width}x${candidate.height}` === name);
    if (viewport === undefined) throw new UsageError(`unknown viewport "${name}"; viewports: ${VIEWPORTS.map((candidate) => `${candidate.width}x${candidate.height}`).join(', ')}`);
    return viewport;
  });
  return { states, viewports, live, apiUrl, shots: resolveShots(values.shots, process.env.BROWSER_SMOKE_SHOTS) };
}

/** What the mock catalogue says the page shows (the same derivation as scripts/check-build.ts). */
async function mockExpectation(state: MockState): Promise<StateExpectation> {
  let overview: Overview | null;
  try {
    overview = await createMockClient(state).overview();
  } catch {
    overview = null; // the unavailable state
  }
  const kind: PageKind = overview === null ? 'unavailable' : overview.asOf === null ? 'empty' : 'data';
  return { state, kind, overview, exact: state === 'ok' || state === 'long-history', demoState: state };
}

async function launch(): Promise<Browser> {
  const executablePath = process.env.BROWSER_SMOKE_CHROME_BIN;
  try {
    // Hermetic without request interception (Playwright aborts and hides favicon requests once the context routes):
    // every host but the local one does not resolve, so a request to another origin is made, recorded and fails.
    // Playwright adds --no-sandbox unless chromiumSandbox is true: the sandbox stays on locally and is off only in CI.
    const options = { headless: true, chromiumSandbox: process.env.CI !== 'true', args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] };
    return await chromium.launch(executablePath === undefined ? { ...options, channel: 'chrome' } : { ...options, executablePath });
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new UsageError(`could not start Google Chrome (${reason}). Install Chrome, or set BROWSER_SMOKE_CHROME_BIN; the smoke downloads no browser`);
  }
}

/**
 * Hovers the middle of a chart until its tooltip shows, re-hovering inside the poll: the tooltip is
 * client-rendered, so it appears only once the page has hydrated. The wait is bounded. The tooltip must be
 * seen as a user sees it: non-empty text in a box that is rendered (display, visibility, opacity, size). A
 * tooltip that never appears is the failure (tip null); one that exists but stays hidden is the failure
 * with its text and tipVisible false.
 */
async function hoverChart(page: Page, chart: Locator, name: string): Promise<HoverFact> {
  await chart.scrollIntoViewIfNeeded();
  const container = await chart.evaluateHandle((svg) => svg.closest('.chart-hover'));
  const deadline = Date.now() + HOVER_MS;
  while (Date.now() < deadline) {
    const box = await chart.boundingBox();
    if (box === null) break;
    await page.mouse.move(box.x + 1, box.y + 1);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
    try {
      await page.waitForFunction(
        (element) => {
          const tip = element?.querySelector('.chart-tip');
          if (!tip || (tip.textContent ?? '').trim() === '') return false;
          const rect = tip.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && tip.checkVisibility({ opacityProperty: true, visibilityProperty: true });
        },
        container,
        { timeout: 500 },
      );
      const text = await container.evaluate((element) => (element?.querySelector('.chart-tip')?.textContent ?? '').trim());
      await page.mouse.move(0, 0); // leave, so that the tooltip of this chart goes away
      return { chart: name, tip: text, tipVisible: true };
    } catch {
      /* not there (visibly) yet: hover again until the deadline */
    }
  }
  const hidden = (await container.evaluate((element) => (element?.querySelector('.chart-tip')?.textContent ?? '').trim())) || null;
  await page.mouse.move(0, 0);
  return { chart: name, tip: hidden, tipVisible: false };
}

async function collectDom(page: Page): Promise<DomFacts> {
  return page.evaluate((): DomFacts => {
    const all = (selector: string) => [...document.querySelectorAll(selector)];
    const attr = (selector: string, name: string) => all(selector).map((element) => element.getAttribute(name) ?? '');
    const svgs = all('svg');
    return {
      pageStates: attr('[data-page-state]', 'data-page-state'),
      kpis: all('[data-kpi]').length,
      chainStates: attr('[data-chain-state]', 'data-chain-state'),
      flows: all('[data-flow]').length,
      blocks: attr('[data-block]', 'data-block'),
      svgs: svgs.length,
      chartSvgs: svgs.filter((svg) => svg.getAttribute('aria-hidden') !== 'true').length,
      unreconciled: all('[data-unreconciled="true"]').length,
      delayedFlags: all('[data-flag="delayed"]').length,
      demoLabels: all('[data-demo-state]').length,
      robots: attr('meta[name="robots"]', 'content'),
    };
  });
}

async function collectTones(page: Page): Promise<ToneFact[]> {
  return page.evaluate((): ToneFact[] =>
    [...document.querySelectorAll('[data-tone]')].map((element) => ({
      card: element.closest('[data-kpi]')?.getAttribute('data-kpi') ?? null,
      text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
      tone: element.getAttribute('data-tone'),
      className: element.getAttribute('class') ?? '',
      color: getComputedStyle(element).color,
    })),
  );
}

/** Opens the page at one width and collects everything the checks need. */
async function collect(browser: Browser, url: string, viewport: { width: number; height: number }, overview: Overview | null): Promise<PageFacts> {
  const origin = new URL(url).origin;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width <= 720 });
  try {
    const page = await context.newPage();
    const consoleEntries: ConsoleEntry[] = [];
    // Requests and responses come from the DevTools Protocol, not from Playwright's events: those leave out /favicon.ico.
    const network = createNetworkLog();
    const cdp = await context.newCDPSession(page);
    cdp.on('Network.requestWillBeSent', network.onRequestWillBeSent);
    cdp.on('Network.responseReceived', network.onResponseReceived);
    cdp.on('Network.loadingFailed', network.onLoadingFailed);
    cdp.on('Network.loadingFinished', network.onLoadingFinished);
    await cdp.send('Network.enable');
    page.on('console', (message) => consoleEntries.push({ type: message.type(), text: message.text() }));
    page.on('pageerror', (error) => consoleEntries.push({ type: 'pageerror', text: error.message }));
    page.on('requestfailed', (request) => consoleEntries.push({ type: 'requestfailed', text: `${request.url()} ${request.failure()?.errorText ?? ''}`.trim() }));

    const navigation = await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    const fontsStatus = await page.evaluate((limit) =>
      Promise.race([document.fonts.ready.then(() => document.fonts.status), new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), limit))]), SETTLE_MS);

    // Charts: hover each one; the first tooltip also proves that the page hydrated.
    const frames = page.locator('.chart-frame svg');
    const hovers: HoverFact[] = [];
    let chartFrames = 0;
    for (let index = 0; index < (await frames.count()); index += 1) {
      const chart = frames.nth(index);
      if (!(await chart.isVisible())) continue;
      chartFrames += 1;
      const hoverable = await chart.evaluate((svg) => svg.closest('.chart-hover') !== null);
      if (!hoverable) continue;
      const block = await chart.evaluate((svg) => svg.closest('[data-block]')?.getAttribute('data-block') ?? 'page');
      hovers.push(await hoverChart(page, chart, `chart ${hovers.length + 1} (${block})`));
    }
    await page.waitForLoadState('networkidle', { timeout: SETTLE_MS }).catch(() => undefined);
    // networkidle ignores the favicon: wait until every request the protocol saw has ended, bounded; what is
    // still open at the bound is reported by the network check.
    for (const deadline = Date.now() + SETTLE_MS; network.pending().length > 0 && Date.now() < deadline; ) await new Promise((resolve) => setTimeout(resolve, 50));

    if (overview?.asOf !== null && overview?.chains.length === 6) await checkLaunchInteractions(page, overview, viewport.width <= 720);
    const widths = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
    const fontFaces = await page.evaluate(() => [...document.fonts].map((face) => ({ family: face.family, status: face.status })));
    return {
      origin,
      documentStatus: navigation?.status() ?? null,
      pendingRequests: network.pending(),
      console: [...consoleEntries, ...network.failures],
      requests: network.requests,
      responses: network.responses,
      ...widths,
      fontsStatus,
      fontFaces,
      dom: await collectDom(page),
      hovers,
      chartFrames,
      tones: await collectTones(page),
      html: await page.content(),
    };
  } finally {
    await context.close();
  }
}

/**
 * The screenshot catalog (docs/design.md), after the checks of one state and width, on its own page
 * context: the full page, and on the six-chain long-history state sections 03–05 of every period with
 * the period switch checked. No reference images and no comparison: the checks never depend on this.
 * A screenshot that cannot be written, or a section the page no longer draws, throws and fails the run
 * (exit 2): `--shots` never ends with no files and a green exit code, and a failed capture takes the
 * files it had written with it, so no half catalog is left behind.
 */
async function captureShots(browser: Browser, url: string, viewport: { width: number; height: number }, state: string, dir: string): Promise<string[]> {
  mkdirSync(dir, { recursive: true });
  const size = `${viewport.width}x${viewport.height}`;
  const files: string[] = [];
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluate((limit) =>
      Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, limit))]), SETTLE_MS);
    const full = path.join(dir, `${state}-${size}.png`);
    files.push(full); // tracked before the write, so a partial file is cleaned up too
    await page.screenshot({ path: full, fullPage: true });
    if (state === 'long-history') {
      for (const period of ['30d', '90d', 'all']) {
        await page.check(`input[name="period"][value="${period}"]`);
        const suffix = period === '30d' ? '' : `-${period}`;
        for (const [block, heading] of [['03', 'h-supply-by-chain'], ['04', 'h-drivers'], ['05', 'h-issuer-vs-bridge']] as const) {
          // 04 is one section per page (its per-period figures hide inside); 03 and 05 have one copy per period.
          const id = heading === 'h-drivers' ? heading : `${heading}${suffix}`;
          const file = path.join(dir, `long-history-${size}-${period}-${block}.png`);
          files.push(file); // tracked before the write, so a partial file is cleaned up too
          await page.locator(`section[aria-labelledby="${id}"]`).screenshot({ path: file });
        }
      }
    }
  } catch (error) {
    for (const file of files) rmSync(file, { force: true }); // no half catalog on failure
    throw error;
  } finally {
    await context.close();
  }
  return files;
}

/** Live mode has no catalogue: the kind is what the page reports, if it is one of the three. */
function liveKind(facts: PageFacts): PageKind | null {
  const [value] = facts.dom.pageStates;
  return facts.dom.pageStates.length === 1 && (value === 'data' || value === 'empty' || value === 'unavailable') ? value : null;
}

async function main(): Promise<number> {
  const refusal = sandboxRefusal(process.env);
  if (refusal !== null) {
    console.error(refusal);
    return 2; // not a pass: Chrome is not started
  }
  const options = parseOptions(process.argv.slice(2));
  if (!existsSync(path.join(WEB, '.next', 'BUILD_ID'))) throw new UsageError('no production build: run `pnpm --filter @app/web build` first');
  const browser = await launch();
  let failures = 0;
  let runs = 0;
  const started = Date.now();
  try {
    for (const state of options.states) {
      const run = async (env: Record<string, string>, expected: StateExpectation, sentinels: string[] = []) => {
        await withServer(env, async (port) => {
          for (const viewport of options.viewports) {
            const name = `${viewport.width}x${viewport.height}`;
            const begun = Date.now();
            const facts = await collect(browser, `http://127.0.0.1:${port}/`, viewport, expected.overview);
            if (sentinels.length > 0) assertNoR2Leaks(facts.html, sentinels, 'hydrated published page');
            const expectation = options.live ? { ...expected, kind: liveKind(facts) } : expected;
            const results = checkPage(facts, expectation);
            const problems = CHECK_IDS.flatMap((id) => results[id].map((problem) => `${id}: ${problem}`));
            runs += 1;
            const seconds = ((Date.now() - begun) / 1000).toFixed(1);
            if (problems.length === 0) {
              log(`${state} ${name}: pass (${CHECK_IDS.length} checks, ${facts.hovers.length} chart hovers, ${seconds}s)`);
            } else {
              failures += problems.length;
              log(`${state} ${name}: FAIL (${seconds}s)`);
              for (const line of groupProblems(problems)) console.error(`  - ${line}`);
            }
            if (options.shots !== null) {
              const files = await captureShots(browser, `http://127.0.0.1:${port}/`, viewport, state, options.shots);
              log(`${state} ${name}: ${files.length} screenshot(s) in ${options.shots}`);
            }
          }
        });
      };
      if (state === 'published') {
        await withFakeR2(async (fake) => run(fake.env, { state, kind: 'data', overview: fake.overview, exact: true, demoState: null }, fake.sentinels));
      } else {
        const env: Record<string, string> = options.live && options.apiUrl !== null ? { API_MODE: 'live', API_URL: options.apiUrl } : { API_MODE: 'mock', MOCK_STATE: state };
        const expected: StateExpectation = options.live ? { state, kind: null, overview: null, exact: false, demoState: null } : await mockExpectation(state as MockState);
        await run(env, expected);
      }
    }
  } finally {
    await browser.close();
  }
  log(`${failures === 0 ? 'ok' : `FAILED, ${failures} problem(s)`}: ${runs} run(s) in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  return failures === 0 ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`browser-smoke · ${error instanceof UsageError ? 'usage' : 'FAILED'}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
