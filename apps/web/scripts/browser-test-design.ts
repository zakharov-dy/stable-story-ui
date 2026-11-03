// The design part of the browser test (see browser-test/README.md): which mockup belongs to which
// state and width, the plain-HTTP server that hands the mockups to the tester's Chrome, and the list
// of accepted differences. Pure helpers, covered by unit tests; the mockups themselves are never in
// the repository (the owner passes the folder with --design-dir).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/** The mockup file per state and viewport width; a missing entry means "no mockup for this width". */
export const DESIGN_FILES: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  ok: { 1440: 'Page-1440.dc.html', 375: 'Page-375.dc.html' },
  delayed: { 1440: 'PS1-delayed.dc.html' },
  unreconciled: { 1440: 'PS2-unreconciled.dc.html', 375: 'PS2-unreconciled-375.dc.html' },
  gap: { 1440: 'PS3-gap.dc.html' },
  'empty-day': { 1440: 'PS4-empty-day.dc.html' },
  empty: { 1440: 'PS6-empty.dc.html', 375: 'PS6-empty-375.dc.html' },
  unavailable: { 1440: 'PS7-unavailable.dc.html', 375: 'PS7-unavailable-375.dc.html' },
  'short-history': {},
  'long-history': {},
};

/** Stylesheets the mockups link relatively; a folder without them would give false differences. */
export const DESIGN_SUPPORT_FILES: readonly string[] = ['bt.css', 'ab.css', 'page.css'];

export const NO_DESIGN_DIR = 'no design dir';
export const NO_MOCKUP = 'no mockup';

export const viewportWidth = (viewport: string): number => Number(viewport.toLowerCase().replace('×', 'x').split('x')[0]);

export type DesignChoice = { file: string } | { skip: string };

/** The mockup of a state at a viewport, or the reason the design check is skipped. */
export function designChoice(state: string, viewport: string, hasDir: boolean): DesignChoice {
  if (!hasDir) return { skip: NO_DESIGN_DIR };
  const file = DESIGN_FILES[state]?.[viewportWidth(viewport)];
  return file === undefined ? { skip: NO_MOCKUP } : { file };
}

/** The text the prompt carries for the design check: per viewport the mockup address or the skip. */
export function designPlan(state: string, viewports: readonly string[], hasDir: boolean, designOrigin: string): string {
  return viewports
    .map((viewport) => {
      const choice = designChoice(state, viewport, hasDir);
      return 'file' in choice
        ? `Viewport ${viewport}: mockup address ${designOrigin}/${choice.file}`
        : `Viewport ${viewport}: no mockup. Mark the design check skipped with the evidence "${choice.skip}"; design_diffs_total is 0.`;
    })
    .join('\n  ');
}

/** The function of fingerprint.js as the prompt carries it: the file without its leading block comment. */
export function fingerprintFunction(file: string): string {
  return file.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '').trim();
}

// ---- The guard against hand-altered fingerprint data -------------------------------------------------

/** The property names the fingerprint emits, read from fingerprint.js itself (its `expose` hook), not copied. */
export interface FingerprintVocabulary {
  props: readonly string[];
  targets: readonly string[];
  fixed: readonly string[];
}

export function fingerprintVocabulary(file: string): FingerprintVocabulary {
  const make = vm.runInNewContext(`(${fingerprintFunction(file)})`) as (hooks: { expose: true }) => {
    PROPS: string[];
    TARGETS: [string, string][];
    MARKS: string[];
    COUNTS: string[];
    PX_SCALARS: string[];
  };
  const exposed = make({ expose: true });
  return {
    props: exposed.PROPS,
    targets: ['root', ...exposed.TARGETS.map(([name]) => name)],
    fixed: ['presence', 'order', 'texts', ...exposed.PX_SCALARS, ...exposed.COUNTS, ...exposed.MARKS.map((mark) => `marks.${mark}`)],
  };
}

// Value shapes exist only where fingerprint.js builds the shape itself: four(...) for padding and margin
// (always four computed values joined by one space) and show(...) of a pixel number for x and width.
// Other values are raw computed values (gap, border, radius, ...) whose form Chrome decides: only the name is checked.
const FOUR_PART = new Set(['padding', 'margin']);
const FOUR_TOKENS = /^\S+( \S+){3}$/; // four(...) joins four computed values with one space; normalizeValue trims and collapses whitespace
const PX_NUMBER = /^-?\d+(\.\d{1,2})?(e[+-]?\d+)?px$/;

/** Why a fingerprint difference cannot have been produced by fingerprint.js, or null when it can. */
export function fingerprintProblem(diff: { property: string; design: string; page: string }, vocabulary: FingerprintVocabulary): string | null {
  const { property } = diff;
  if (vocabulary.fixed.includes(property)) {
    if (property === 'x' || property === 'width') {
      for (const side of ['design', 'page'] as const) if (!PX_NUMBER.test(diff[side])) return `${property} ${side} value "${diff[side]}" is not a pixel number`;
    }
    return null;
  }
  if (property.startsWith('styles.')) return vocabulary.targets.includes(property.slice('styles.'.length)) ? null : `unknown target in "${property}"`;
  // Target names contain dots themselves (tag.cctp), so match the target as a prefix instead of splitting at the first dot.
  const prop = vocabulary.targets.map((name) => (property.startsWith(`${name}.`) ? property.slice(name.length + 1) : null)).find((rest) => rest !== null && vocabulary.props.includes(rest));
  if (prop === undefined || prop === null) return `"${property}" is not a property the fingerprint emits`;
  if (FOUR_PART.has(prop)) {
    for (const side of ['design', 'page'] as const) {
      const parts = diff[side].split(' ').filter(Boolean).length;
      if (!FOUR_TOKENS.test(diff[side])) return `${property} ${side} value "${diff[side]}" has ${parts} parts, the fingerprint always gives 4`;
    }
  }
  return null;
}

/** The files the requested states and viewports need that are not in the folder (empty: all there). */
export function missingDesignFiles(dir: string, states: readonly string[], viewports: readonly string[], exists: (file: string) => boolean): string[] {
  const needed = new Set<string>();
  for (const state of states) {
    for (const viewport of viewports) {
      const choice = designChoice(state, viewport, true);
      if ('file' in choice) needed.add(choice.file);
    }
  }
  if (needed.size > 0) for (const file of DESIGN_SUPPORT_FILES) needed.add(file);
  return [...needed].filter((file) => !exists(path.join(dir, file)));
}

// ---- The mockup server --------------------------------------------------------------------------------

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

export interface DesignResponse {
  status: number;
  type: string;
  body: Uint8Array | string;
}

/** The answer to a request to the mockup server: flat files of the folder of known types, nothing else. */
export function designResponse(dir: string, method: string | undefined, rawUrl: string | undefined, read: (file: string) => Uint8Array = readFileSync): DesignResponse {
  const notFound: DesignResponse = { status: 404, type: 'text/plain; charset=utf-8', body: 'not found' };
  if (method !== 'GET' && method !== 'HEAD') return { status: 405, type: 'text/plain; charset=utf-8', body: 'method not allowed' };
  let name: string;
  try {
    name = decodeURIComponent((rawUrl ?? '/').split(/[?#]/)[0] ?? '/').replace(/^\//, '');
  } catch {
    return notFound;
  }
  if (name === '' || name.includes('/') || name.includes('\\') || name.includes('\0') || name.startsWith('.')) return notFound;
  const type = CONTENT_TYPES[path.extname(name).toLowerCase()];
  if (type === undefined) return notFound;
  try {
    return { status: 200, type, body: read(path.join(dir, name)) };
  } catch {
    return notFound;
  }
}

// ---- Accepted differences -----------------------------------------------------------------------------

export interface AcceptedDiff {
  state?: string;
  viewport?: string;
  block: string;
  property: string;
  reason: string;
}

export const normalizeViewport = (viewport: string): string => viewport.toLowerCase().replace('×', 'x').replace(/\s/g, '');

/** The accepted-differences file: a list of {state?, viewport?, block, property, reason}. */
export function parseAccepted(value: unknown): { accepted: AcceptedDiff[]; problems: string[] } {
  if (!Array.isArray(value)) return { accepted: [], problems: ['the accepted list must be a JSON array'] };
  const accepted: AcceptedDiff[] = [];
  const problems: string[] = [];
  value.forEach((entry: unknown, index) => {
    const at = `accepted[${index}]`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      problems.push(`${at} must be an object`);
      return;
    }
    const before = problems.length;
    const record = entry as Record<string, unknown>;
    for (const key of Object.keys(record)) if (!['state', 'viewport', 'block', 'property', 'reason'].includes(key)) problems.push(`${at}.${key} is not allowed`);
    for (const key of ['block', 'property', 'reason']) {
      const field = record[key];
      if (typeof field !== 'string' || field.trim() === '') problems.push(`${at}.${key} must be a non-empty string`);
    }
    for (const key of ['state', 'viewport']) {
      if (key in record && (typeof record[key] !== 'string' || record[key].trim() === '')) problems.push(`${at}.${key} must be a non-empty string when present`);
    }
    if (problems.length === before) {
      accepted.push({
        ...(typeof record.state === 'string' ? { state: record.state } : {}),
        ...(typeof record.viewport === 'string' ? { viewport: record.viewport } : {}),
        block: record.block as string,
        property: record.property as string,
        reason: record.reason as string,
      });
    }
  });
  return { accepted, problems };
}

/** Whether a difference is on the list: block and property exactly, state and viewport when the entry names them. */
export function isAccepted(list: readonly AcceptedDiff[], state: string, diff: { viewport: string; block: string; property: string }): boolean {
  return list.some(
    (entry) =>
      entry.block === diff.block &&
      entry.property === diff.property &&
      (entry.state === undefined || entry.state === state) &&
      (entry.viewport === undefined || normalizeViewport(entry.viewport) === normalizeViewport(diff.viewport)),
  );
}
