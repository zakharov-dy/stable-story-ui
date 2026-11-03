// Design comparison of the web page with the design mockups by the `agy` CLI (see
// browser-test/README.md). Run with `pnpm --filter @app/web browser-test --out <dir>`. Not part of CI: it
// needs `agy` and Chrome. The technical checks belong to browser-smoke.ts.
//
// The states form one queue that --concurrency slots work off (a freed slot takes the next state).
// Slot i has its own page server (--port + i), its own Chrome (port 9223 + i, headless unless --headed,
// profile ~/.chrome-test for slot 0 and ~/.chrome-test-<i+1> for the others) and its own agent file whose
// only MCP server is that Chrome. Per state: `next start`, one `agy` run with every viewport inside it,
// the raw envelope and the parsed report into --out; then summary.json. With --design-dir a plain HTTP
// server of this script hands the design mockups to the testers. Everything this script starts is
// stopped again, also on errors and on SIGINT / SIGTERM; a Chrome that already answers on its port is
// used and never closed.

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mockStates } from '../src/server/config.ts';
import { designPlan, designResponse, fingerprintFunction, fingerprintProblem, fingerprintVocabulary, isAccepted, missingDesignFiles, parseAccepted, type AcceptedDiff, type FingerprintVocabulary } from './browser-test-design.ts';

const WEB = path.join(import.meta.dirname, '..');
const REPO = path.join(WEB, '..', '..');
const NEXT_BIN = path.join(WEB, 'node_modules', 'next', 'dist', 'bin', 'next');
const PROMPT_FILE = path.join(WEB, 'browser-test', 'prompt.md');
const SCHEMA_FILE = path.join(WEB, 'browser-test', 'report.schema.json');
const FINGERPRINT_FILE = path.join(WEB, 'browser-test', 'fingerprint.js');
const ACCEPTED_FILE = path.join(WEB, 'browser-test', 'design-accepted.json');
const AGENTS_DIR = path.join(WEB, '.agents', 'agents');
const AGENT_FILE = path.join(AGENTS_DIR, 'browser-tester.md');

const CHROME_PORT = 9223; // slot 0; slot i uses CHROME_PORT + i
const PROTECTED_PORT = 9222; // the owner's other Chrome: this script never uses or probes it
const MAX_CONCURRENCY = 8;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_WEB_PORT = 3100;
const DEFAULT_DESIGN_PORT = 3190;
const DEFAULT_CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_VIEWPORTS = ['1440x900', '375x812'];
const AGY_PRINT_TIMEOUT = '20m';
const AGY_KILL_AFTER_MS = 21 * 60_000;
const LIGHT_STATES = ['empty', 'unavailable']; // ~100 s each against ~250 s: they go last in the queue

export interface Options {
  out: string;
  states: string[];
  viewports: string[];
  model: string;
  port: number;
  dryRun: boolean;
  concurrency: number;
  designDir: string | null;
  designPort: number;
  headed: boolean;
}

export class UsageError extends Error {
  override name = 'UsageError';
}

const VIEWPORT = /^[1-9]\d{2,4}x[1-9]\d{2,4}$/;

const integerIn = (raw: string, flag: string, min: number, max: number): number => {
  const number = Number(raw);
  if (!/^\d+$/.test(raw) || number < min || number > max) throw new UsageError(`${flag} must be an integer from ${min} to ${max}`);
  return number;
};

/** The command line into options; anything unknown or inconsistent is a UsageError. */
export function parseArgs(argv: readonly string[], states: readonly string[] = mockStates): Options {
  const options: Options = {
    out: '', states: [...states], viewports: [...DEFAULT_VIEWPORTS], model: '', port: DEFAULT_WEB_PORT, dryRun: false,
    concurrency: DEFAULT_CONCURRENCY, designDir: null, designPort: DEFAULT_DESIGN_PORT, headed: false,
  };
  const value = (index: number, flag: string): string => {
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) throw new UsageError(`${flag} needs a value`);
    return next;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index] ?? '';
    switch (flag) {
      case '--out':
        options.out = value(index++, flag);
        break;
      case '--states':
        options.states = value(index++, flag).split(',').map((item) => item.trim()).filter(Boolean);
        break;
      case '--viewports':
        options.viewports = value(index++, flag).split(',').map((item) => item.trim()).filter(Boolean);
        break;
      case '--model':
        options.model = value(index++, flag);
        break;
      case '--port':
        options.port = integerIn(value(index++, flag), '--port', 1, 65535);
        break;
      case '--concurrency':
        options.concurrency = integerIn(value(index++, flag), '--concurrency', 1, MAX_CONCURRENCY);
        break;
      case '--design-dir':
        options.designDir = value(index++, flag);
        break;
      case '--design-port':
        options.designPort = integerIn(value(index++, flag), '--design-port', 1, 65535);
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        throw new UsageError(`unknown argument ${flag}`);
    }
  }
  if (options.out === '') throw new UsageError('--out <dir> is required');
  // No built-in model and no vendor default: the caller names the model the comparison runs on.
  if (options.model === '') throw new UsageError('--model <name> is required');
  if (options.viewports.length === 0) throw new UsageError('--viewports needs at least one WIDTHxHEIGHT');
  for (const viewport of options.viewports) {
    if (!VIEWPORT.test(viewport)) throw new UsageError(`bad viewport "${viewport}", expected WIDTHxHEIGHT such as 1440x900`);
  }
  if (options.states.length === 0) throw new UsageError('--states needs at least one state');
  for (const state of options.states) {
    if (!states.includes(state)) throw new UsageError(`unknown state "${state}", expected one of ${states.join(', ')}`);
  }
  // A repeated state would run twice into the same files and results; a repeated width twice in a report.
  const repeated = (items: readonly string[]): string | undefined => items.find((item, index) => items.indexOf(item) !== index);
  const twiceState = repeated(options.states);
  if (twiceState !== undefined) throw new UsageError(`state "${twiceState}" is given twice`);
  const twiceViewport = repeated(options.viewports.map((viewport) => viewport.toLowerCase()));
  if (twiceViewport !== undefined) throw new UsageError(`viewport "${twiceViewport}" is given twice`);
  checkPorts(options);
  return options;
}

/** The page ports of the slots, the Chrome ports and the mockup port must be valid and must not overlap. */
function checkPorts(options: Options): void {
  const slots = Math.min(options.concurrency, options.states.length);
  const web = Array.from({ length: slots }, (_, slot) => options.port + slot);
  const chrome = Array.from({ length: slots }, (_, slot) => CHROME_PORT + slot);
  if (web.some((port) => port > 65535)) throw new UsageError(`--port ${options.port} with ${slots} slot(s) runs past port 65535`);
  const claims: [string, number[]][] = [['--port', web], ['--design-port', [options.designPort]]];
  for (const [flag, ports] of claims) {
    if (ports.includes(PROTECTED_PORT)) throw new UsageError(`${flag} ${String(PROTECTED_PORT)} belongs to another Chrome and is never used`);
    if (ports.some((port) => chrome.includes(port))) throw new UsageError(`${flag} collides with a test Chrome port (${chrome.join(', ')})`);
  }
  if (web.includes(options.designPort)) throw new UsageError('--design-port collides with a page port of a slot');
}

/** The prompt template with its {PLACEHOLDERS} replaced; a placeholder without a value is an error. */
export function renderPrompt(template: string, values: Readonly<Record<string, string>>): string {
  const rendered = template.replace(/\{([A-Z_]+)\}/g, (match, name: string) => {
    const replacement = values[name];
    if (replacement === undefined) throw new UsageError(`no value for the prompt placeholder ${match}`);
    return replacement;
  });
  return rendered;
}

// ---- Slots and the queue ----------------------------------------------------------------------------

export interface SlotPlan {
  slot: number;
  webPort: number;
  chromePort: number;
  profile: string;
  agent: string;
}

/** The slots of a run: as many as --concurrency, but never more than there are states. */
export function slotPlans(options: Pick<Options, 'port' | 'concurrency' | 'states'>, home: string = os.homedir()): SlotPlan[] {
  const count = Math.min(options.concurrency, options.states.length);
  return Array.from({ length: count }, (_, slot) => ({
    slot,
    webPort: options.port + slot,
    chromePort: CHROME_PORT + slot,
    profile: path.join(home, slot === 0 ? '.chrome-test' : `.chrome-test-${slot + 1}`),
    agent: slot === 0 ? 'browser-tester' : `browser-tester-slot${slot}`,
  }));
}

/** The order the slots take states in: the long ones first, the short ones (empty, unavailable) last. */
export function queueOrder(states: readonly string[]): string[] {
  return [...states.filter((state) => !LIGHT_STATES.includes(state)), ...states.filter((state) => LIGHT_STATES.includes(state))];
}

/**
 * Works the states off with `slots` workers: a worker that is free takes the next state from the front
 * of the queue. A slot for which `usable` is false takes nothing. Results come back in the order of
 * `states`; a state nobody took (all slots unusable) is undefined.
 */
export async function runQueue<T>(states: readonly string[], slots: number, run: (slot: number, state: string) => Promise<T>, usable: (slot: number) => boolean = () => true): Promise<(T | undefined)[]> {
  // Results are kept per position, so a state that appears twice never overwrites its own earlier result.
  const queue = states.map((state, index) => ({ state, index }));
  queue.sort((a, b) => Number(LIGHT_STATES.includes(a.state)) - Number(LIGHT_STATES.includes(b.state)));
  const results: (T | undefined)[] = states.map(() => undefined);
  const worker = async (slot: number): Promise<void> => {
    while (usable(slot)) {
      const next = queue.shift();
      if (next === undefined) return;
      results[next.index] = await run(slot, next.state);
    }
  };
  await Promise.all(Array.from({ length: slots }, (_, slot) => worker(slot)));
  return results;
}

/** The agent file of a slot: the template with its name and Chrome port. Slot 0 is the template itself. */
export function renderAgent(template: string, plan: Pick<SlotPlan, 'agent' | 'chromePort'>): string {
  const browserUrl = `--browser-url=http://127.0.0.1:${CHROME_PORT}`;
  if (template.split(browserUrl).length !== 2) throw new Error(`the agent template must name the Chrome port exactly once (${browserUrl})`);
  if (!/^name: browser-tester$/m.test(template)) throw new Error('the agent template must have the line "name: browser-tester"');
  return template.replace(/^name: browser-tester$/m, `name: ${plan.agent}`).replaceAll(String(CHROME_PORT), String(plan.chromePort));
}

// ---- The report -------------------------------------------------------------------------------------

export const CHECK_IDS = ['design'] as const; // the technical checks are browser-smoke's
export const CHECK_STATUSES = ['pass', 'fail', 'skipped'] as const;
export const DIFF_SOURCES = ['fingerprint', 'model'] as const;

export interface DesignDiff {
  viewport: string;
  block: string;
  property: string;
  design: string;
  page: string;
  note: string;
  source: (typeof DIFF_SOURCES)[number];
}

export interface Report {
  url: string;
  state: string;
  viewports: { viewport: string; checks: { id: string; status: string; evidence: string }[]; design_diffs_total: number }[];
  design_diffs: DesignDiff[];
  missing_tools: string[];
  notes: string;
}

type Obj = Record<string, unknown>;
const isObject = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Checks an object against its exact key set; returns the problems at `at`. */
function shape(value: unknown, at: string, keys: readonly string[]): string[] {
  if (!isObject(value)) return [`${at} must be an object`];
  const problems: string[] = [];
  for (const key of keys) if (!(key in value)) problems.push(`${at}.${key} is missing`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) problems.push(`${at}.${key} is not allowed`);
  return problems;
}

const text = (value: unknown, at: string): string[] => (typeof value === 'string' ? [] : [`${at} must be a string`]);
const count = (value: unknown, at: string): string[] => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? [] : [`${at} must be an integer of 0 or more`]);
const oneOf = (value: unknown, at: string, allowed: readonly string[]): string[] =>
  typeof value === 'string' && allowed.includes(value) ? [] : [`${at} must be one of ${allowed.join('|')}`];

/** A hand-written validator of report.schema.json (kept in step with it by a test). Empty: valid. */
export function validateReport(value: unknown): string[] {
  const top = shape(value, 'report', ['url', 'state', 'viewports', 'design_diffs', 'missing_tools', 'notes']);
  if (top.length > 0 || !isObject(value)) return top;
  const problems: string[] = [...text(value.url, 'report.url'), ...text(value.state, 'report.state'), ...text(value.notes, 'report.notes')];
  const list = (field: string, item: (entry: unknown, at: string) => string[]) => {
    const entries = value[field];
    if (!Array.isArray(entries)) {
      problems.push(`report.${field} must be an array`);
      return;
    }
    entries.forEach((entry, index) => problems.push(...item(entry, `report.${field}[${index}]`)));
  };
  list('viewports', (entry, at) => {
    const found = shape(entry, at, ['viewport', 'checks', 'design_diffs_total']);
    if (found.length > 0 || !isObject(entry)) return found;
    const inner = [...text(entry.viewport, `${at}.viewport`), ...count(entry.design_diffs_total, `${at}.design_diffs_total`)];
    if (!Array.isArray(entry.checks)) return [...inner, `${at}.checks must be an array`];
    entry.checks.forEach((check, index) => {
      const where = `${at}.checks[${index}]`;
      const checkProblems = shape(check, where, ['id', 'status', 'evidence']);
      if (checkProblems.length > 0 || !isObject(check)) inner.push(...checkProblems);
      else inner.push(...oneOf(check.id, `${where}.id`, CHECK_IDS), ...oneOf(check.status, `${where}.status`, CHECK_STATUSES), ...text(check.evidence, `${where}.evidence`));
    });
    return inner;
  });
  list('design_diffs', (entry, at) => {
    const found = shape(entry, at, ['viewport', 'block', 'property', 'design', 'page', 'note', 'source']);
    if (found.length > 0 || !isObject(entry)) return found;
    return [
      ...text(entry.viewport, `${at}.viewport`), ...text(entry.block, `${at}.block`), ...text(entry.property, `${at}.property`),
      ...text(entry.design, `${at}.design`), ...text(entry.page, `${at}.page`), ...text(entry.note, `${at}.note`), ...oneOf(entry.source, `${at}.source`, DIFF_SOURCES),
    ];
  });
  list('missing_tools', (entry, at) => text(entry, at));
  return problems;
}

const normalizeViewport = (viewport: string): string => viewport.toLowerCase().replace('×', 'x').replace(/\s/g, '');

/** Every requested viewport must be in the report; a report that skips one is not a result. */
export function missingViewports(report: Report, requested: readonly string[]): string[] {
  const reported = new Set(report.viewports.map((entry) => normalizeViewport(entry.viewport)));
  return requested.filter((viewport) => !reported.has(normalizeViewport(viewport)));
}

/** Per requested viewport: exactly one entry holding the design check exactly once. */
export function incompleteViewports(report: Report, requested: readonly string[]): string[] {
  const problems: string[] = [];
  for (const viewport of requested) {
    const entries = report.viewports.filter((entry) => normalizeViewport(entry.viewport) === normalizeViewport(viewport));
    if (entries.length !== 1) {
      problems.push(entries.length === 0 ? `the report has no entry for the viewport ${viewport}` : `the report has ${entries.length} entries for the viewport ${viewport}`);
      continue;
    }
    const ids = entries[0]?.checks.map((check) => check.id) ?? [];
    for (const id of CHECK_IDS) {
      const times = ids.filter((found) => found === id).length;
      if (times !== 1) problems.push(`viewport ${viewport}: check ${id} ${times === 0 ? 'is missing' : `appears ${times} times`}`);
    }
  }
  return problems;
}

export type Extracted = { report: Report; source: 'structured_output' | 'response' } | { error: string };

const JSON_BLOCK = /```json\s*([\s\S]*?)```/gi;

/** The report of an `agy --output-format json` envelope: structured_output, else the last valid JSON block of the response. */
export function extractReport(envelope: unknown): Extracted {
  if (!isObject(envelope)) return { error: 'the agy output is not a JSON object' };
  const errors: string[] = [];
  const structured = envelope.structured_output;
  if (structured !== undefined && structured !== null) {
    const problems = validateReport(structured);
    if (problems.length === 0) return { report: structured as Report, source: 'structured_output' };
    errors.push(`structured_output: ${problems.slice(0, 5).join('; ')}`);
  }
  const response = envelope.response;
  if (typeof response !== 'string' || response.trim() === '') {
    errors.push('no response text');
    return { error: errors.join(' | ') };
  }
  const candidates = [...response.matchAll(JSON_BLOCK)].map((match) => match[1] ?? '');
  if (candidates.length === 0) candidates.push(response.trim());
  let last = 'no JSON block in the response';
  // The last syntactically parseable block is the report; its shape is then checked, never skipped.
  let selected: { value: unknown } | null = null;
  for (const candidate of candidates) {
    try {
      selected = { value: JSON.parse(candidate) };
    } catch (error) {
      last = `response JSON does not parse: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  if (selected !== null) {
    const problems = validateReport(selected.value);
    if (problems.length === 0) return { report: selected.value as Report, source: 'response' };
    last = `response report has the wrong shape: ${problems.slice(0, 5).join('; ')}`;
  }
  errors.push(last);
  return { error: errors.join(' | ') };
}

// ---- Design differences -----------------------------------------------------------------------------

export type AnnotatedDiff = DesignDiff & { accepted: boolean };
/** A difference the guard took out of `design_diffs`: `problem` is why fingerprint.js cannot have produced it, null for the other fingerprint items of its altered viewport. */
export type RejectedDiff = DesignDiff & { problem: string | null };
export type AnnotatedReport = Omit<Report, 'design_diffs'> & { design_diffs: AnnotatedDiff[]; rejected_design_diffs: RejectedDiff[] };

let defaultVocabulary: FingerprintVocabulary | null = null;
const fingerprintWords = (): FingerprintVocabulary => (defaultVocabulary ??= fingerprintVocabulary(readFileSync(FINGERPRINT_FILE, 'utf8')));

/**
 * The differences of a report against the accepted list. `designDiffs` counts every difference the
 * tester found (also those cut off by the limit of listed ones) that is not accepted; only listed ones
 * can be accepted. None of this ever reaches the exit code.
 *
 * Two deterministic corrections of the model's report:
 * - Guard. A `fingerprint` difference that fingerprint.js cannot have produced (an unknown property, a
 *   padding or margin that is not 4 parts, an x or width that is not a pixel number) means the model
 *   altered the data. All `fingerprint` differences of that viewport then move to `rejected_design_diffs`
 *   and its design check becomes `skipped` ("fingerprint data altered"). `designRejected` counts the
 *   items that failed the guard.
 * - Status. A viewport whose listed differences are all accepted (none cut off) gets the design check
 *   `pass` ("N differences, all accepted"); a `fail` with some not accepted stays and names how many.
 */
export function annotateDesign(
  report: Report,
  state: string,
  accepted: readonly AcceptedDiff[],
  vocabulary: FingerprintVocabulary = fingerprintWords(),
): { report: AnnotatedReport; designDiffs: number; designAccepted: number; designRejected: number } {
  const problems = report.design_diffs.map((diff) => (diff.source === 'fingerprint' ? fingerprintProblem(diff, vocabulary) : null));
  const altered = new Set(report.design_diffs.filter((_, index) => problems[index] !== null).map((diff) => normalizeViewport(diff.viewport)));
  const rejected: RejectedDiff[] = [];
  const kept: DesignDiff[] = [];
  report.design_diffs.forEach((diff, index) => {
    if (diff.source === 'fingerprint' && altered.has(normalizeViewport(diff.viewport))) rejected.push({ ...diff, problem: problems[index] ?? null });
    else kept.push(diff);
  });
  const diffs = kept.map((diff) => ({ ...diff, accepted: isAccepted(accepted, state, diff) }));
  const known = new Set(report.viewports.map((entry) => normalizeViewport(entry.viewport)));
  let total = diffs.filter((diff) => !known.has(normalizeViewport(diff.viewport))).length;
  const viewports = report.viewports.map((entry) => {
    const key = normalizeViewport(entry.viewport);
    const own = diffs.filter((diff) => normalizeViewport(diff.viewport) === key);
    const checks = entry.checks.map((check) => ({ ...check }));
    const design = checks.find((check) => check.id === 'design');
    let reported = entry.design_diffs_total;
    if (altered.has(key)) {
      reported = own.length;
      const bad = rejected.filter((diff) => normalizeViewport(diff.viewport) === key && diff.problem !== null);
      if (design) {
        design.status = 'skipped';
        design.evidence = `fingerprint data altered: ${bad.length} item(s) rejected (first: ${bad[0]?.block} ${bad[0]?.problem})`;
      }
    } else if (design && design.status !== 'skipped') {
      const accepts = own.filter((diff) => diff.accepted).length;
      const everything = Math.max(reported, own.length);
      const remaining = everything - accepts;
      if (remaining === 0 && own.length > 0) {
        design.status = 'pass';
        design.evidence = `${own.length} differences, all accepted`;
      } else if (remaining > 0) {
        // Any difference that is not accepted (also an unlisted one) makes the comparison a fail, whatever the model wrote.
        if (design.status === 'fail') design.evidence = accepts > 0 ? `${design.evidence} (${remaining} not accepted)` : design.evidence;
        else design.evidence = `${everything} differences, ${remaining} not accepted`;
        design.status = 'fail';
      }
    }
    total += Math.max(reported, own.length);
    return { ...entry, checks, design_diffs_total: reported };
  });
  const designAccepted = diffs.filter((diff) => diff.accepted).length;
  const designRejected = problems.filter((problem) => problem !== null).length;
  return { report: { ...report, viewports, design_diffs: diffs, rejected_design_diffs: rejected }, designDiffs: total - designAccepted, designAccepted, designRejected };
}

// ---- The summary ------------------------------------------------------------------------------------

export interface StateResult {
  state: string;
  agyStatus: string; // the envelope status, or SPAWN_ERROR / TIMEOUT / NO_OUTPUT / START_ERROR / NOT_RUN / ABORTED
  missingTools: string[];
  totalTokens: number | null;
  durationSeconds: number | null;
  parseError: string | null;
  designDiffs: number; // not accepted; does not influence the exit code
  designAccepted: number;
  designRejected: number; // fingerprint differences the guard found altered; does not influence the exit code
  slot: number | null;
}

/** One state's result from the envelope (null: agy gave none) and the requested viewports. */
export function summarizeState(state: string, envelope: unknown, failure: string | null, viewports: readonly string[], accepted: readonly AcceptedDiff[] = [], slot: number | null = null): StateResult {
  const result: StateResult = { state, agyStatus: failure ?? 'NO_OUTPUT', missingTools: [], totalTokens: null, durationSeconds: null, parseError: null, designDiffs: 0, designAccepted: 0, designRejected: 0, slot };
  if (isObject(envelope)) {
    result.agyStatus = failure ?? (typeof envelope.status === 'string' ? envelope.status : 'NO_STATUS');
    const usage = envelope.usage;
    if (isObject(usage) && typeof usage.total_tokens === 'number') result.totalTokens = usage.total_tokens;
    if (typeof envelope.duration_seconds === 'number') result.durationSeconds = envelope.duration_seconds;
  }
  if (envelope === null || envelope === undefined) {
    result.parseError = 'agy produced no JSON envelope';
    return result;
  }
  const extracted = extractReport(envelope);
  if ('error' in extracted) {
    result.parseError = extracted.error;
    return result;
  }
  const { report } = extracted;
  result.missingTools = report.missing_tools;
  const design = annotateDesign(report, state, accepted);
  result.designDiffs = design.designDiffs;
  result.designAccepted = design.designAccepted;
  result.designRejected = design.designRejected;
  const incomplete = incompleteViewports(report, viewports);
  if (incomplete.length > 0) result.parseError = incomplete.slice(0, 5).join('; ');
  return result;
}

/** A state that never produced an agy result (a slot failed to start, the run was interrupted). */
export function failedResult(state: string, status: string, message: string, slot: number | null = null): StateResult {
  return { state, agyStatus: status, missingTools: [], totalTokens: null, durationSeconds: null, parseError: message, designDiffs: 0, designAccepted: 0, designRejected: 0, slot };
}

/** A run fails on any agy failure and on any report that did not parse or is incomplete. Design differences never count. */
export function hasFailure(results: readonly StateResult[]): boolean {
  return results.some((result) => result.agyStatus !== 'SUCCESS' || result.parseError !== null);
}

export function formatSummary(results: readonly StateResult[]): string {
  const lines = results.map((result) => {
    const extra = [
      result.agyStatus === 'SUCCESS' ? '' : `agy ${result.agyStatus}`,
      result.parseError === null ? '' : `parse error: ${result.parseError}`,
      result.missingTools.length === 0 ? '' : `missing tools: ${result.missingTools.join(', ')}`,
    ].filter(Boolean);
    const tokens = result.totalTokens === null ? '-' : String(result.totalTokens);
    const seconds = result.durationSeconds === null ? '-' : `${Math.round(result.durationSeconds)}s`;
    const design = `design diffs ${result.designDiffs}${result.designAccepted > 0 ? ` (+${result.designAccepted} accepted)` : ''}${result.designRejected > 0 ? ` (${result.designRejected} altered, rejected)` : ''}`;
    return `${result.state.padEnd(14)} ${design} · ${tokens} tokens · ${seconds}${extra.length > 0 ? ` · ${extra.join(' · ')}` : ''}`;
  });
  lines.push(hasFailure(results) ? 'RESULT: failed' : 'RESULT: ok');
  return lines.join('\n');
}

// ---- Commands ---------------------------------------------------------------------------------------

export function agyArgs(options: Pick<Options, 'model'>, prompt: string, agent = 'browser-tester'): string[] {
  return ['--agent', agent, '--model', options.model, '--dangerously-skip-permissions', '-p', prompt, '--output-format', 'json', '--json-schema', SCHEMA_FILE, '--print-timeout', AGY_PRINT_TIMEOUT];
}

export function nextEnv(state: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
  delete env.API_MODE;
  delete env.API_URL;
  delete env.MOCK_STATE;
  return { ...env, API_MODE: 'mock', MOCK_STATE: state };
}

export const nextArgs = (port: number): string[] => [NEXT_BIN, 'start', '-p', String(port), '-H', '127.0.0.1'];

const chromeBin = (): string => process.env.BROWSER_TEST_CHROME_BIN ?? DEFAULT_CHROME_BIN;

/** Chrome of a slot: headless unless --headed, its own debugging port and profile. Never the owner's other Chrome. */
export function chromeArgs(plan: Pick<SlotPlan, 'chromePort' | 'profile'>, headed: boolean): string[] {
  if (plan.chromePort === PROTECTED_PORT) throw new Error(`port ${String(PROTECTED_PORT)} belongs to another Chrome and is never used`);
  return [...(headed ? [] : ['--headless=new']), `--remote-debugging-port=${plan.chromePort}`, `--user-data-dir=${plan.profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'];
}

const pageUrl = (port: number): string => `http://127.0.0.1:${port}/`;
const designOrigin = (port: number): string => `http://127.0.0.1:${port}`;

// ---- Processes --------------------------------------------------------------------------------------

/**
 * Everything the script started and must stop again. After `shutdown` has begun nothing new can be
 * registered: `assertOpen` (call it right before spawning) throws, and a task added anyway runs at once.
 * Without that a state that starts while a SIGTERM is being handled would spawn a process after the
 * cleanup has taken its list, and the process would outlive the script.
 */
export class ProcessRegistry {
  private tasks: (() => Promise<void>)[] = [];
  private late: Promise<void>[] = [];
  private closing: Promise<void> | null = null;
  private down = false;

  get shuttingDown(): boolean {
    return this.down;
  }

  assertOpen(): void {
    if (this.down) throw new Error('browser-test is shutting down: nothing new is started');
  }

  add(task: () => Promise<void>): void {
    if (this.down) {
      this.late.push(this.run(task));
      throw new Error('browser-test is shutting down: nothing new is started');
    }
    this.tasks.push(task);
  }

  private async run(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      console.error(`browser-test: cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Runs every task once, last registered first, until none is left; safe to call again. */
  shutdown(): Promise<void> {
    this.down = true;
    this.closing ??= (async () => {
      for (;;) {
        const task = this.tasks.pop();
        if (task !== undefined) {
          await this.run(task);
          continue;
        }
        const late = this.late.splice(0);
        if (late.length === 0) return;
        await Promise.all(late);
      }
    })();
    return this.closing;
  }
}

const registry = new ProcessRegistry();

export interface GroupOps {
  kill(pid: number, signal: NodeJS.Signals | 0): void;
  sleep(ms: number): Promise<void>;
  now(): number;
}

const realOps: GroupOps = { kill: (pid, signal) => process.kill(pid, signal), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now: () => Date.now() };

/**
 * Ends the process group `pid` (a detached child is its group leader) whether or not the leader is
 * still alive: SIGTERM, then SIGKILL after `graceMs`, until no member is left. Returns false if
 * members survive even SIGKILL.
 */
export async function terminateGroup(pid: number, ops: GroupOps = realOps, graceMs = 5000, pollMs = 50): Promise<boolean> {
  const alive = (): boolean => {
    try {
      ops.kill(-pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
  };
  const send = (signal: NodeJS.Signals) => {
    try {
      ops.kill(-pid, signal);
    } catch {
      // already gone
    }
  };
  const gone = async (ms: number): Promise<boolean> => {
    const end = ops.now() + ms;
    while (alive()) {
      if (ops.now() >= end) return false;
      await ops.sleep(pollMs);
    }
    return true;
  };
  if (!alive()) return true;
  send('SIGTERM');
  if (await gone(graceMs)) return true;
  send('SIGKILL');
  return gone(2000);
}

const stopGroup = async (child: ChildProcess): Promise<void> => {
  if (child.pid !== undefined) await terminateGroup(child.pid);
};

/** Spawns a detached child (its own process group) and registers its stop in one synchronous step. */
function spawnTracked(command: string, args: string[], options: SpawnOptions): ChildProcess {
  registry.assertOpen();
  const child = spawn(command, args, { ...options, detached: true });
  registry.add(() => stopGroup(child));
  return child;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function chromeAnswers(port: number): Promise<boolean> {
  if (port === PROTECTED_PORT) throw new Error(`port ${String(PROTECTED_PORT)} belongs to another Chrome and is never probed`);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

function onPath(command: string): boolean {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (dir === '') continue;
    try {
      accessSync(path.join(dir, command), constants.X_OK);
      return true;
    } catch {
      // next directory
    }
  }
  return false;
}

/** Uses the Chrome that already answers on the slot's port, else starts our own (stopped at the end). */
async function ensureChrome(plan: SlotPlan, headed: boolean): Promise<void> {
  const args = chromeArgs(plan, headed);
  if (await chromeAnswers(plan.chromePort)) {
    console.log(`browser-test · slot ${plan.slot}: Chrome already answers on ${plan.chromePort}: using it, it stays open`);
    return;
  }
  console.log(`browser-test · slot ${plan.slot}: starting Chrome (${headed ? 'with a window' : 'headless'}) with the profile ${plan.profile} on port ${plan.chromePort}`);
  const child = spawnTracked(chromeBin(), args, { stdio: 'ignore' });
  child.once('error', (error) => console.error(`browser-test: Chrome of slot ${plan.slot} did not start: ${error.message}`));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Chrome of slot ${plan.slot} exited with ${String(child.exitCode)}`);
    if (await chromeAnswers(plan.chromePort)) return;
    await sleep(300);
  }
  throw new Error(`Chrome did not answer on port ${plan.chromePort} in 30 s`);
}

async function startWeb(plan: SlotPlan, state: string): Promise<ChildProcess> {
  const child = spawnTracked(process.execPath, nextArgs(plan.webPort), { cwd: WEB, env: nextEnv(state), stdio: ['ignore', 'ignore', 'inherit'] });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited with ${String(child.exitCode)}`);
    try {
      await fetch(`http://127.0.0.1:${plan.webPort}/__browser-test-ready`, { signal: AbortSignal.timeout(2000) });
      return child;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`next start on port ${plan.webPort} did not become ready`);
}

/** The mockup server: flat files of the --design-dir folder over plain HTTP on 127.0.0.1, stopped at the end. */
async function startDesignServer(dir: string, port: number): Promise<void> {
  registry.assertOpen();
  const server = http.createServer((request, response) => {
    const answer = designResponse(dir, request.method, request.url);
    response.writeHead(answer.status, { 'content-type': answer.type, 'cache-control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : answer.body);
  });
  registry.add(
    () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  );
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

interface AgyOutcome {
  stdout: string;
  stderr: string;
  failure: string | null;
}

function runAgy(options: Options, plan: SlotPlan, prompt: string): Promise<AgyOutcome> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawnTracked('agy', agyArgs(options, prompt, plan.agent), { cwd: WEB, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    let stdout = '';
    let stderr = '';
    let failure: string | null = null;
    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    const timer = setTimeout(() => {
      failure = 'TIMEOUT';
      void stopGroup(child);
    }, AGY_KILL_AFTER_MS);
    child.once('error', (error) => {
      failure = 'SPAWN_ERROR';
      stderr += error.message;
      clearTimeout(timer);
      resolve({ stdout, stderr, failure });
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (failure === null && code !== 0) failure = `EXIT_${String(code)}`;
      void stopGroup(child).finally(() => resolve({ stdout, stderr, failure }));
    });
  });
}

function parseEnvelope(stdout: string): unknown {
  try {
    return JSON.parse(stdout.trim());
  } catch {
    return null;
  }
}

const isInside = (dir: string, parent: string): boolean => {
  const relative = path.relative(parent, dir);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const isDirectory = (dir: string): boolean => {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
};

/** Loads the accepted differences of the repository; null (with a message) when the file is unusable. */
function loadAccepted(): { accepted: AcceptedDiff[] } | { error: string } {
  try {
    const parsed = parseAccepted(JSON.parse(readFileSync(ACCEPTED_FILE, 'utf8')));
    if (parsed.problems.length > 0) return { error: `${path.relative(REPO, ACCEPTED_FILE)}: ${parsed.problems.slice(0, 5).join('; ')}` };
    return { accepted: parsed.accepted };
  } catch (error) {
    return { error: `${path.relative(REPO, ACCEPTED_FILE)}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function main(): Promise<number> {
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`browser-test: ${error.message}`);
      return 2;
    }
    throw error;
  }
  const out = path.resolve(options.out);
  if (isInside(out, REPO)) {
    console.error('browser-test: --out must be outside the repository');
    return 2;
  }
  let designDir: string | null = null;
  if (options.designDir !== null) {
    designDir = path.resolve(options.designDir);
    if (isInside(designDir, REPO)) {
      console.error('browser-test: --design-dir must be outside the repository (the mockups are never committed)');
      return 2;
    }
    if (!isDirectory(designDir)) {
      console.error(`browser-test: --design-dir is not a directory: ${designDir}`);
      return 2;
    }
    const missing = missingDesignFiles(designDir, options.states, options.viewports, existsSync);
    if (missing.length > 0) {
      console.error(`browser-test: --design-dir lacks ${missing.join(', ')}`);
      return 2;
    }
  }
  const loaded = loadAccepted();
  if ('error' in loaded) {
    console.error(`browser-test: ${loaded.error}`);
    return 2;
  }
  const { accepted } = loaded;
  const plans = slotPlans(options);
  const queue = queueOrder(options.states);
  const template = readFileSync(PROMPT_FILE, 'utf8');
  const fingerprint = fingerprintFunction(readFileSync(FINGERPRINT_FILE, 'utf8'));
  const promptFor = (state: string, plan: SlotPlan) =>
    renderPrompt(template, {
      URL: pageUrl(plan.webPort),
      STATE: state,
      VIEWPORTS: options.viewports.join(', '),
      DESIGN_PLAN: designPlan(state, options.viewports, designDir !== null, designOrigin(options.designPort)),
      FINGERPRINT: fingerprint,
    });

  if (options.dryRun) {
    console.log(`browser-test · dry run, nothing is started. Output: ${out}`);
    console.log(`\nSlots (${plans.length}), Chrome ${options.headed ? 'with a window (--headed)' : 'headless (--headless=new)'}:`);
    for (const plan of plans) {
      console.log(`  slot ${plan.slot}: page 127.0.0.1:${plan.webPort} · Chrome port ${plan.chromePort} (used as it is if it answers) · profile ${plan.profile} · agent ${plan.agent}`);
      console.log(`    Chrome: ${JSON.stringify([chromeBin(), ...chromeArgs(plan, options.headed)])}`);
    }
    console.log(`\nDesign: ${designDir === null ? `none (the design check is skipped: "no design dir")` : `${designDir} served on ${designOrigin(options.designPort)}`}`);
    console.log(`Accepted design differences: ${accepted.length}`);
    console.log(`\nQueue (a freed slot takes the next state): ${queue.join(', ')}`);
    for (const state of queue) {
      const env = `API_MODE=mock MOCK_STATE=${state}`;
      const prompt = promptFor(state, plans[0] ?? { slot: 0, webPort: options.port, chromePort: CHROME_PORT, profile: '', agent: 'browser-tester' });
      const shown = agyArgs(options, `<prompt, ${prompt.length} chars>`, '<agent of the slot>');
      console.log(`\n[${state}]\n  (cwd ${WEB}) ${env} node ${nextArgs(options.port).join(' ')}   (port of the slot that takes it)\n  (cwd ${WEB}) agy ${shown.map((arg) => JSON.stringify(arg)).join(' ')}`);
    }
    const first = queue[0] ?? '';
    console.log(`\nPrompt of "${first}" on slot 0:\n${promptFor(first, plans[0] ?? { slot: 0, webPort: options.port, chromePort: CHROME_PORT, profile: '', agent: 'browser-tester' })}`);
    return 0;
  }

  if (!existsSync(path.join(WEB, '.next')) || !existsSync(NEXT_BIN)) {
    console.error('browser-test: no build found. Run `pnpm --filter @app/web build` first.');
    return 2;
  }
  if (!onPath('agy')) {
    console.error('browser-test: `agy` is not in PATH.');
    return 2;
  }
  const ports = [...plans.map((plan) => plan.webPort), ...(designDir === null ? [] : [options.designPort])];
  for (const port of ports) {
    if (!(await portIsFree(port))) {
      console.error(`browser-test: port ${port} is busy; free it or pass --port / --design-port.`);
      return 2;
    }
  }
  mkdirSync(out, { recursive: true });

  const results: StateResult[] = [];
  const allDiffs: ({ state: string } & AnnotatedDiff)[] = [];
  try {
    // The agent files of the slots after the first one; slot 0 is the committed agent itself.
    const agentTemplate = readFileSync(AGENT_FILE, 'utf8');
    for (const plan of plans.slice(1)) {
      const file = path.join(AGENTS_DIR, `${plan.agent}.md`);
      registry.assertOpen();
      writeFileSync(file, renderAgent(agentTemplate, plan));
      registry.add(() => Promise.resolve(rmSync(file, { force: true })));
    }
    if (designDir !== null) {
      await startDesignServer(designDir, options.designPort);
      console.log(`browser-test · mockups of ${designDir} on ${designOrigin(options.designPort)}`);
    }
    const chromeFailures = new Map<number, string>();
    await Promise.all(
      plans.map(async (plan) => {
        try {
          await ensureChrome(plan, options.headed);
        } catch (error) {
          chromeFailures.set(plan.slot, error instanceof Error ? error.message : String(error));
        }
      }),
    );
    const runState = async (slot: number, state: string): Promise<StateResult> => {
      const plan = plans[slot];
      if (plan === undefined) return failedResult(state, 'START_ERROR', `no slot ${slot}`);
      if (registry.shuttingDown) return failedResult(state, 'ABORTED', 'the run was interrupted', slot);
      try {
        console.log(`browser-test · ${state}: slot ${slot}, starting the page on port ${plan.webPort}`);
        const web = await startWeb(plan, state);
        try {
          console.log(`browser-test · ${state}: agy (${options.model}) as ${plan.agent}, viewports ${options.viewports.join(', ')}`);
          const outcome = await runAgy(options, plan, promptFor(state, plan));
          const envelope = parseEnvelope(outcome.stdout);
          writeFileSync(path.join(out, envelope === null ? `${state}.agy-stdout.txt` : `${state}.envelope.json`), outcome.stdout);
          if (outcome.stderr.trim() !== '') writeFileSync(path.join(out, `${state}.agy-stderr.txt`), outcome.stderr);
          const extracted = envelope === null ? null : extractReport(envelope);
          if (extracted !== null && 'report' in extracted) {
            const annotated = annotateDesign(extracted.report, state, accepted);
            writeFileSync(path.join(out, `${state}.report.json`), `${JSON.stringify(annotated.report, null, 2)}\n`);
            for (const diff of annotated.report.design_diffs) if (!diff.accepted) allDiffs.push({ state, ...diff });
          }
          console.log(`browser-test · ${state}: done`);
          return summarizeState(state, envelope, outcome.failure, options.viewports, accepted, slot);
        } finally {
          await stopGroup(web);
        }
      } catch (error) {
        return failedResult(state, 'START_ERROR', error instanceof Error ? error.message : String(error), slot);
      }
    };
    const outcomes = await runQueue(options.states, plans.length, runState, (slot) => !chromeFailures.has(slot));
    options.states.forEach((state, index) => {
      results.push(outcomes[index] ?? failedResult(state, 'NOT_RUN', `no slot could take it: ${[...chromeFailures.values()].join('; ') || 'the run was interrupted'}`));
    });
  } catch (error) {
    console.error(`browser-test: ${error instanceof Error ? error.message : String(error)}`);
    for (const state of options.states) if (!results.some((result) => result.state === state)) results.push(failedResult(state, 'NOT_RUN', error instanceof Error ? error.message : String(error)));
  } finally {
    await registry.shutdown();
    writeFileSync(
      path.join(out, 'summary.json'),
      `${JSON.stringify({ model: options.model, viewports: options.viewports, concurrency: plans.length, headless: !options.headed, design: designDir !== null, failed: hasFailure(results), results }, null, 2)}\n`,
    );
    if (designDir !== null) writeFileSync(path.join(out, 'design-diffs.json'), `${JSON.stringify(allDiffs, null, 2)}\n`);
  }
  console.log(`\n${formatSummary(results)}\nReports: ${out}`);
  return hasFailure(results) ? 1 : 0;
}

if (import.meta.main) {
  const stop = (code: number) => () => {
    void registry.shutdown().finally(() => process.exit(code));
  };
  process.on('SIGINT', stop(130));
  process.on('SIGTERM', stop(143));
  main().then(
    (code) => process.exit(code),
    async (error: unknown) => {
      console.error(`browser-test: ${error instanceof Error ? error.message : String(error)}`);
      await registry.shutdown();
      process.exit(1);
    },
  );
}
