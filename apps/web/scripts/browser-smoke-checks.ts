// The checks of the browser smoke (scripts/browser-smoke.ts) as pure functions over data collected from
// the page: no browser, no I/O. Each returns the list of problems, empty when the check passes. The rules
// are the technical checks of the design-comparison browser test (browser-test/prompt.md), stated exactly; where the
// prompt was vague the choice is written next to the rule.

import type { Overview } from '@app/contracts';
import { ALL_BLOCKS, checkPageHtml } from '../src/checks/page-html.ts';

export const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 320, height: 800 },
] as const;

export type PageKind = 'data' | 'empty' | 'unavailable';

/** What the page must show: derived from the mock catalogue (`overview` null: the API fails). */
export interface StateExpectation {
  state: string; // the mock state, or "live"
  kind: PageKind | null; // null: live mode, taken from what the page reports and validated against the allowed values
  overview: Overview | null;
  /** Exact chart/status counts for the ordinary and six-chain long-history scenarios. */
  exact: boolean;
  demoState: string | null; // the label of a mock state; null for live data
}

export interface ConsoleEntry {
  type: string; // console message type, or "pageerror" / "requestfailed"
  text: string;
}

export interface ResponseEntry {
  url: string;
  status: number;
}

export interface FontFaceFact {
  family: string;
  status: string;
}

export interface DomFacts {
  pageStates: string[]; // values of [data-page-state]
  kpis: number;
  chainStates: string[]; // values of [data-chain-state]
  flows: number;
  blocks: string[]; // values of [data-block]
  svgs: number; // every svg
  chartSvgs: number; // svgs that draw something: not aria-hidden
  unreconciled: number; // [data-unreconciled="true"]
  delayedFlags: number; // [data-flag="delayed"]
  demoLabels: number; // [data-demo-state]
  robots: string[]; // content of <meta name="robots">
}

export interface HoverFact {
  chart: string; // the block of the chart and its position, for the message
  tip: string | null; // the text of .chart-tip after the hover, null when none appeared
  tipVisible: boolean; // the tooltip is rendered and seen: not display:none, hidden, transparent or empty-boxed
}

export interface ToneFact {
  card: string | null; // the [data-kpi] around it
  text: string;
  tone: string | null;
  className: string;
  color: string; // computed
}

export interface PageFacts {
  interactions: string[];
  origin: string;
  documentStatus: number | null;
  pendingRequests: string[]; // CDP-observed requests (favicon included) still without an end when collection stopped
  console: ConsoleEntry[];
  requests: string[]; // URLs of every request
  responses: ResponseEntry[];
  scrollWidth: number;
  innerWidth: number;
  fontsStatus: string;
  fontFaces: FontFaceFact[];
  dom: DomFacts;
  hovers: HoverFact[];
  chartFrames: number; // visible .chart-frame svgs: what hovering applies to
  tones: ToneFact[];
  html: string; // the DOM after hydration
}

// ---- network collection ------------------------------------------------------------------------------

/**
 * Collects what the browser itself requests from Chrome DevTools Protocol `Network` events. Playwright's
 * request / response / requestfailed events leave out `/favicon.ico` (it hides such requests, and aborts them
 * when the context routes), and a favicon 404 is one of the things the smoke must see, so the collection
 * goes below Playwright. The handlers take the used fields of the CDP payloads; requests, responses and
 * favicon failures (a favicon that failed before an answer; Playwright reports the other failures) are
 * what checkNetwork and the console check read.
 */
export interface NetworkLog {
  requests: string[];
  responses: ResponseEntry[];
  failures: ConsoleEntry[];
  /** URLs of the requests that have neither finished nor failed: Playwright's networkidle ignores the favicon, this does not. */
  pending: () => string[];
  onRequestWillBeSent: (event: { requestId: string; request: { url: string } }) => void;
  onResponseReceived: (event: { requestId: string; response: { url: string; status: number } }) => void;
  onLoadingFailed: (event: { requestId: string; errorText: string }) => void;
  onLoadingFinished: (event: { requestId: string }) => void;
}

export function createNetworkLog(): NetworkLog {
  const urls = new Map<string, string>(); // requestId -> url
  const open = new Map<string, string>(); // requestId -> url, until the request finishes or fails
  const log: NetworkLog = {
    requests: [],
    responses: [],
    failures: [],
    pending: () => [...open.values()],
    onRequestWillBeSent: (event) => {
      urls.set(event.requestId, event.request.url);
      open.set(event.requestId, event.request.url);
      log.requests.push(event.request.url);
    },
    onResponseReceived: (event) => {
      log.responses.push({ url: event.response.url, status: event.response.status });
    },
    onLoadingFinished: (event) => {
      open.delete(event.requestId);
    },
    onLoadingFailed: (event) => {
      open.delete(event.requestId);
      const url = urls.get(event.requestId);
      if (url?.endsWith('/favicon.ico')) log.failures.push({ type: 'requestfailed', text: `${url} ${event.errorText}` });
    },
  };
  return log;
}

// ---- console -----------------------------------------------------------------------------------------

// A production build minifies the React messages: errors 418, 419, 422, 423 and 425 are the hydration ones.
const HYDRATION = /hydrat|react\.dev\/errors\/(418|419|422|423|425)\b|React error #(418|419|422|423|425)\b/i;

/** No console error or warning, no page error, no failed request. A hydration message is named as such. */
export function checkConsole(entries: ConsoleEntry[]): string[] {
  const problems: string[] = [];
  for (const entry of entries) {
    if (!['error', 'warning', 'pageerror', 'requestfailed'].includes(entry.type)) continue;
    const hydration = HYDRATION.test(entry.text) ? ' (hydration, a blocker)' : '';
    problems.push(`console ${entry.type}${hydration}: ${entry.text}`);
  }
  return problems;
}

// ---- network -----------------------------------------------------------------------------------------

/**
 * Every request goes to the page's own origin and no response is 400 or more. A `data:` or `blob:` URL
 * is not a network request and is allowed (the prompt left it open). The document answers 200.
 */
export function checkNetwork(facts: Pick<PageFacts, 'origin' | 'requests' | 'responses' | 'documentStatus' | 'pendingRequests'>): string[] {
  const problems: string[] = [];
  for (const url of facts.requests) {
    if (url.startsWith('data:') || url.startsWith('blob:')) continue;
    let origin: string | null = null;
    try {
      origin = new URL(url).origin;
    } catch {
      /* unparsable: reported below */
    }
    if (origin !== facts.origin) problems.push(`request to another origin: ${url}`);
  }
  for (const response of facts.responses) {
    if (response.status >= 400) problems.push(`${response.status} for ${response.url}`);
  }
  for (const url of facts.pendingRequests) problems.push(`no answer yet when collection stopped: ${url}`);
  if (facts.documentStatus !== 200) problems.push(`the document answered ${String(facts.documentStatus)}, expected 200`);
  return problems;
}

// ---- overflow ----------------------------------------------------------------------------------------

export function checkOverflow(facts: Pick<PageFacts, 'scrollWidth' | 'innerWidth'>): string[] {
  return facts.scrollWidth <= facts.innerWidth ? [] : [`horizontal overflow: scrollWidth ${facts.scrollWidth} > innerWidth ${facts.innerWidth}`];
}

// ---- fonts -------------------------------------------------------------------------------------------

/**
 * `document.fonts.status` is "loaded" and no font face is in error. Added to the prompt: at least one
 * .woff2 file was answered with 200, so "loaded" cannot pass on an empty set of fonts. That the font
 * files come from the page's origin is part of the network check.
 */
export function checkFonts(facts: Pick<PageFacts, 'fontsStatus' | 'fontFaces' | 'responses'>): string[] {
  const problems: string[] = [];
  if (facts.fontsStatus !== 'loaded') problems.push(`document.fonts.status is "${facts.fontsStatus}", expected "loaded"`);
  for (const face of facts.fontFaces) {
    if (face.status === 'error') problems.push(`font face ${face.family} is in error`);
  }
  const files = facts.responses.filter((response) => /\.woff2(\?|$)/.test(response.url) && response.status === 200);
  if (files.length === 0) problems.push('no .woff2 font file was loaded');
  return problems;
}

// ---- page state and blocks ---------------------------------------------------------------------------

const countOf = (values: readonly string[], value: string): number => values.filter((candidate) => candidate === value).length;

/** The page-state row of the prompt for the state. */
export function checkPageState(facts: Pick<PageFacts, 'dom' | 'html'>, expectation: StateExpectation): string[] {
  const { dom } = facts;
  const problems: string[] = [];
  const expect = (condition: boolean, message: string) => {
    if (!condition) problems.push(message);
  };
  const kind = expectation.kind;
  if (kind === null) {
    problems.push(`data-page-state is "${dom.pageStates.join(',')}", expected one of data, empty, unavailable`);
    return problems;
  }
  expect(dom.pageStates.length === 1 && dom.pageStates[0] === kind, `expected data-page-state="${kind}" once, found [${dom.pageStates.join(',')}]`);
  const present = (block: string) => countOf(dom.blocks, block);
  expect(dom.demoLabels === (expectation.demoState === null ? 0 : 1), 'demo label count');
  expect(dom.kpis === 0, 'KPI cards must be removed');
  if (kind === 'data') {
    for (const block of ALL_BLOCKS) expect(present(block) === 1, `expected ${block} once`);
    const overview = expectation.overview;
    if (overview !== null) {
      const charts = Object.values(overview.views).filter((view) => view !== null).length * 2
        + Object.values(overview.views).reduce((total, view) => total + (view?.drivers.length ?? 0), 0) + 1;
      expect(dom.chartSvgs === charts, `expected ${charts} data SVGs, found ${dom.chartSvgs}`);
      expect(dom.chainStates.length === overview.chains.length * 3, 'chain list, status table and phone status list each carry every chain state');
      if (overview.status.chains.some((status) => status.state === 'delayed')) expect(dom.delayedFlags > 0, 'delayed quality mark');
      if (overview.status.chains.some((status) => status.state === 'unreconciled')) expect(dom.unreconciled > 0, 'unreconciled quality mark');
    }
  } else {
    expect(dom.chartSvgs === 0 && dom.flows === 0, `${kind} must have no charts or flows`);
    for (const block of ALL_BLOCKS) expect(present(block) === 0, `${kind} must not draw ${block}`);
    expect(dom.chainStates.length === (kind === 'empty' ? expectation.overview?.chains.length ?? 0 : 0), `${kind} chain dots`);
    if (kind === 'unavailable') expect(dom.robots.includes('noindex'), 'outage noindex');
  }
  return problems;
}

/**
 * The full HTML expectation of the server render (checkPageHtml, the one check:build uses) applied to the
 * DOM after hydration. Only for mock states: it needs the overview the page was given.
 */
export function checkHydratedHtml(html: string, expectation: StateExpectation): string[] {
  if (expectation.state === 'live') return [];
  return checkPageHtml(html, { overview: expectation.overview, demoState: expectation.demoState }).map((problem) => `hydrated HTML: ${problem}`);
}

// ---- chart hover -------------------------------------------------------------------------------------

/**
 * Every hoverable chart showed a non-empty, visible .chart-tip (a tooltip hidden by CSS is as good as none). Skipped (no problems) when the page has no
 * chart. The prompt hovered up to three charts; the smoke hovers all of them.
 */
export function checkChartHover(facts: Pick<PageFacts, 'hovers' | 'chartFrames'>): string[] {
  if (facts.chartFrames === 0) return [];
  const problems: string[] = [];
  if (facts.hovers.length === 0) problems.push(`${facts.chartFrames} chart(s) on the page and none could be hovered`);
  for (const hover of facts.hovers) {
    if (hover.tip === null || hover.tip.trim() === '') problems.push(`no tooltip after hovering ${hover.chart}`);
    else if (!hover.tipVisible) problems.push(`the tooltip of ${hover.chart} exists but is not visible`);
  }
  return problems;
}

// ---- all ---------------------------------------------------------------------------------------------

export const CHECK_IDS = ['console', 'network', 'overflow', 'fonts', 'page-state', 'html', 'chart-hover', 'home-interactions'] as const;
export type CheckId = (typeof CHECK_IDS)[number];

/** Every check of a page at one width: its problems by check id. Tone colours are skipped on empty and unavailable pages. */
export function checkPage(facts: PageFacts, expectation: StateExpectation): Record<CheckId, string[]> {
  return {
    'home-interactions': facts.interactions,
    console: checkConsole(facts.console),
    network: checkNetwork(facts),
    overflow: checkOverflow(facts),
    fonts: checkFonts(facts),
    'page-state': checkPageState(facts, expectation),
    html: checkHydratedHtml(facts.html, expectation),
    'chart-hover': checkChartHover(facts),
  };
}

/** The same problem repeated (a console error per chart, say) is one line with its count. */
export function groupProblems(problems: string[]): string[] {
  const counts = new Map<string, number>();
  for (const problem of problems) counts.set(problem, (counts.get(problem) ?? 0) + 1);
  return [...counts].map(([problem, times]) => (times > 1 ? `${problem} (x${times})` : problem));
}

/**
 * A sandbox that cannot launch Chrome sets `BROWSER_SMOKE_UNSUPPORTED_SANDBOX`: Chrome aborts at
 * startup there, registering with the window server, and macOS shows a crash dialog per launch. The
 * smoke refuses to start there; this is not a pass. Returns the message to print, or null when Chrome
 * may be launched.
 */
export function sandboxRefusal(env: Record<string, string | undefined>): string | null {
  return env.BROWSER_SMOKE_UNSUPPORTED_SANDBOX === undefined || env.BROWSER_SMOKE_UNSUPPORTED_SANDBOX === ''
    ? null
    : 'browser-smoke: not run inside a sandbox that cannot start Chrome (BROWSER_SMOKE_UNSUPPORTED_SANDBOX); CI runs it';
}
