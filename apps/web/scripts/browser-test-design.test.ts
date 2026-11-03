import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  DESIGN_FILES,
  DESIGN_SUPPORT_FILES,
  designChoice,
  designPlan,
  designResponse,
  fingerprintFunction,
  fingerprintProblem,
  fingerprintVocabulary,
  isAccepted,
  missingDesignFiles,
  parseAccepted,
  viewportWidth,
} from './browser-test-design.ts';
import { mockStates } from '../src/server/config.ts';

const WEB = path.join(import.meta.dirname, '..');

describe('the mockup of a state and width', () => {
  it('has the files of the agreed table', () => {
    expect(DESIGN_FILES).toEqual({
      ok: { 1440: 'Page-1440.dc.html', 375: 'Page-375.dc.html' },
      delayed: { 1440: 'PS1-delayed.dc.html' },
      unreconciled: { 1440: 'PS2-unreconciled.dc.html', 375: 'PS2-unreconciled-375.dc.html' },
      gap: { 1440: 'PS3-gap.dc.html' },
      'empty-day': { 1440: 'PS4-empty-day.dc.html' },
      empty: { 1440: 'PS6-empty.dc.html', 375: 'PS6-empty-375.dc.html' },
      unavailable: { 1440: 'PS7-unavailable.dc.html', 375: 'PS7-unavailable-375.dc.html' },
      'short-history': {},
      'long-history': {},
    });
  });

  it('covers every mock state', () => {
    for (const state of mockStates) expect(Object.keys(DESIGN_FILES), state).toContain(state);
  });

  it('picks the mockup of the same width, 1440 and 375', () => {
    expect(designChoice('ok', '1440x900', true)).toEqual({ file: 'Page-1440.dc.html' });
    expect(designChoice('ok', '375x812', true)).toEqual({ file: 'Page-375.dc.html' });
    expect(designChoice('empty', '375x812', true)).toEqual({ file: 'PS6-empty-375.dc.html' });
  });

  it('skips the width without its own mockup, and never uses the 1440 one instead', () => {
    for (const state of ['delayed', 'gap', 'empty-day']) expect(designChoice(state, '375x812', true), state).toEqual({ skip: 'no mockup' });
    expect(designChoice('short-history', '1440x900', true)).toEqual({ skip: 'no mockup' });
    expect(designChoice('short-history', '375x812', true)).toEqual({ skip: 'no mockup' });
    expect(designChoice('ok', '800x600', true)).toEqual({ skip: 'no mockup' });
    expect(designChoice('live', '1440x900', true)).toEqual({ skip: 'no mockup' });
  });

  it('skips everything without a design folder', () => {
    expect(designChoice('ok', '1440x900', false)).toEqual({ skip: 'no design dir' });
  });

  it('reads the width of a viewport', () => {
    expect(viewportWidth('1440x900')).toBe(1440);
    expect(viewportWidth('375×812')).toBe(375);
  });

  it('writes the plan of the prompt per viewport', () => {
    const plan = designPlan('delayed', ['1440x900', '375x812'], true, 'http://127.0.0.1:3190');
    expect(plan).toContain('Viewport 1440x900: mockup address http://127.0.0.1:3190/PS1-delayed.dc.html');
    expect(plan).toContain('Viewport 375x812: no mockup. Mark the design check skipped with the evidence "no mockup"');
    expect(designPlan('ok', ['1440x900'], false, 'http://127.0.0.1:3190')).toContain('"no design dir"');
  });

  it('reports the files a folder lacks, including the stylesheets', () => {
    const present = new Set(['/d/Page-1440.dc.html', '/d/bt.css']);
    expect(missingDesignFiles('/d', ['ok'], ['1440x900'], (file) => present.has(file))).toEqual(['ab.css', 'page.css']);
    expect(missingDesignFiles('/d', ['ok'], ['1440x900', '375x812'], (file) => present.has(file))).toEqual(['Page-375.dc.html', 'ab.css', 'page.css']);
    expect(missingDesignFiles('/d', ['ok'], ['1440x900'], () => true)).toEqual([]);
  });

  it('needs nothing from the folder when no requested pair has a mockup', () => {
    expect(missingDesignFiles('/d', ['short-history'], ['1440x900'], () => false)).toEqual([]);
    expect(missingDesignFiles('/d', ['delayed'], ['375x812'], () => false)).toEqual([]);
    expect(DESIGN_SUPPORT_FILES).toEqual(['bt.css', 'ab.css', 'page.css']);
  });
});

describe('the mockup server', () => {
  const files: Record<string, string> = { '/d/Page-1440.dc.html': '<html></html>', '/d/bt.css': 'a{}', '/d/secret.js': 'x', '/d/notes.txt': 'n' };
  const read = (file: string): Uint8Array => {
    const body = files[file];
    if (body === undefined) throw new Error('ENOENT');
    return new TextEncoder().encode(body);
  };
  const get = (url: string | undefined, method = 'GET') => designResponse('/d', method, url, read);

  it('serves a known file with its type', () => {
    expect(get('/Page-1440.dc.html')).toMatchObject({ status: 200, type: 'text/html; charset=utf-8' });
    expect(get('/bt.css?v=1')).toMatchObject({ status: 200, type: 'text/css; charset=utf-8' });
    expect(get('/bt.css', 'HEAD').status).toBe(200);
  });

  it('answers 404 for a file that is not there (support.js is absent on purpose)', () => {
    expect(get('/support.js').status).toBe(404);
    expect(get('/missing.css').status).toBe(404);
    expect(get('/').status).toBe(404);
    expect(get(undefined).status).toBe(404);
  });

  it('does not serve scripts or other types, even if the file exists', () => {
    expect(get('/secret.js').status).toBe(404);
    expect(get('/notes.txt').status).toBe(404);
  });

  it('does not leave the folder', () => {
    for (const url of ['/../etc/passwd', '/%2e%2e/x.css', '/a/b.css', '/..%2fx.css', '/%5Cx.css', '/.hidden.css', '/x%00.css', '/%E0%A4%A.css']) {
      expect(get(url).status, url).toBe(404);
    }
  });

  it('allows only reads', () => {
    expect(get('/bt.css', 'POST').status).toBe(405);
    expect(designResponse('/d', undefined, '/bt.css', read).status).toBe(405);
  });
});

describe('accepted differences', () => {
  const shipped = JSON.parse(readFileSync(path.join(WEB, 'browser-test', 'design-accepted.json'), 'utf8')) as unknown;

  it('the shipped list parses without problems and every entry has a reason in English', () => {
    const parsed = parseAccepted(shipped);
    expect(parsed.problems).toEqual([]);
    expect(parsed.accepted).toHaveLength(66);
    for (const entry of parsed.accepted) expect(entry.reason, entry.block).toMatch(/^[\x20-\x7e]+$/);
  });

  it('the shipped list hides texts only for the recorded states and blocks, and nothing the fingerprint no longer reports', () => {
    const { accepted } = parseAccepted(shipped);
    const properties = new Set(accepted.map((entry) => entry.property));
    expect([...properties].sort()).toEqual(['charts', 'legendItems', 'presence', 'root.margin', 'sparks', 'texts']);
    for (const gone of ['marks.chainState', 'marks.flow', 'styles.tag']) expect(properties.has(gone), gone).toBe(false);
    const texts = accepted.filter((entry) => entry.property === 'texts').map((entry) => `${entry.state ?? '*'}/${entry.block}`);
    expect(texts).toHaveLength(17);
    expect(texts.every((entry) => !entry.startsWith('*/'))).toBe(true);
  });

  it('the shipped list matches a difference of its state, block and property on either width', () => {
    const { accepted } = parseAccepted(shipped);
    const diff = (viewport: string) => ({ viewport, block: 'day-equation', property: 'presence' });
    expect(isAccepted(accepted, 'gap', diff('1440x900'))).toBe(true);
    expect(isAccepted(accepted, 'gap', diff('375x812'))).toBe(true);
    expect(isAccepted(accepted, 'ok', diff('1440x900'))).toBe(false);
    expect(isAccepted(accepted, 'gap', { viewport: '1440x900', block: 'day-equation', property: 'texts' })).toBe(false);
    expect(isAccepted(accepted, 'unreconciled', { viewport: '375x812', block: 'day-equation', property: 'texts' })).toBe(true);
    expect(isAccepted(accepted, 'ok', { viewport: '1440x900', block: 'day-equation', property: 'texts' })).toBe(false);
  });

  it('parses entries with and without state and viewport', () => {
    const parsed = parseAccepted([{ block: 'header', property: 'padding', reason: 'r' }, { state: 'ok', viewport: '375x812', block: 'feed', property: 'texts', reason: 'r2' }]);
    expect(parsed.problems).toEqual([]);
    expect(parsed.accepted).toEqual([{ block: 'header', property: 'padding', reason: 'r' }, { state: 'ok', viewport: '375x812', block: 'feed', property: 'texts', reason: 'r2' }]);
  });

  it.each([
    [{}, 'the accepted list must be a JSON array'],
    [[1], 'accepted[0] must be an object'],
    [[{ block: 'a', property: 'b' }], 'accepted[0].reason must be a non-empty string'],
    [[{ block: '', property: 'b', reason: 'r' }], 'accepted[0].block must be a non-empty string'],
    [[{ block: 'a', property: 'b', reason: 'r', extra: 1 }], 'accepted[0].extra is not allowed'],
    [[{ block: 'a', property: 'b', reason: 'r', state: 3 }], 'accepted[0].state must be a non-empty string when present'],
  ])('rejects %j', (value, problem) => {
    expect(parseAccepted(value).problems).toContain(problem);
  });

  it('keeps only the valid entries', () => {
    const parsed = parseAccepted([{ block: 'a', property: 'b', reason: 'r' }, { block: 'a' }]);
    expect(parsed.accepted).toHaveLength(1);
    expect(parsed.problems.length).toBeGreaterThan(0);
  });

  it('matches by block and property, and by state and viewport when the entry names them', () => {
    const diff = { viewport: '375x812', block: 'header', property: 'padding' };
    expect(isAccepted([{ block: 'header', property: 'padding', reason: 'r' }], 'ok', diff)).toBe(true);
    expect(isAccepted([{ block: 'header', property: 'margin', reason: 'r' }], 'ok', diff)).toBe(false);
    expect(isAccepted([{ block: 'feed', property: 'padding', reason: 'r' }], 'ok', diff)).toBe(false);
    expect(isAccepted([{ state: 'ok', block: 'header', property: 'padding', reason: 'r' }], 'gap', diff)).toBe(false);
    expect(isAccepted([{ state: 'ok', block: 'header', property: 'padding', reason: 'r' }], 'ok', diff)).toBe(true);
    expect(isAccepted([{ viewport: '1440x900', block: 'header', property: 'padding', reason: 'r' }], 'ok', diff)).toBe(false);
    expect(isAccepted([{ viewport: '375×812', block: 'header', property: 'padding', reason: 'r' }], 'ok', diff)).toBe(true);
    expect(isAccepted([], 'ok', diff)).toBe(false);
  });
});

// ---- The fingerprint function, loaded the way the tester runs it (no DOM: the pure parts) ----------------

type Style = Record<string, string>;
interface RawBlock {
  name: string;
  x: number;
  width: number;
  columns: number;
  charts: number;
  sparks: number;
  legendItems: number;
  marks: { kpi: number };
  texts: string[];
  styles: Record<string, Style>;
}
interface Fingerprint {
  viewport: { w: number; h: number };
  order: string[];
  blocks: Record<string, RawBlock & Record<string, unknown>>;
}
interface Diff {
  block: string;
  property: string;
  design: string;
  page: string;
}
interface Api {
  maskText(text: string): string;
  normalizeValue(prop: string, value: string): string;
  sameValue(a: unknown, b: unknown): boolean;
  normalize(raw: { viewport: { w: number; h: number }; blocks: RawBlock[] }): Fingerprint;
  diff(design: Fingerprint, page: Fingerprint): { diffs: Diff[]; total: number; notInMockup: string[] };
  LIMIT: number;
  PROPS: string[];
  TEXT_SELECTOR: string;
  TARGETS: [string, string][];
  MARKS: string[];
}
type Run = (hooks: unknown) => Record<string, unknown>;

const source = readFileSync(path.join(WEB, 'browser-test', 'fingerprint.js'), 'utf8');
const fingerprint = vm.runInNewContext(`(${fingerprintFunction(source)})`) as Run;
const api = fingerprint({ expose: true }) as unknown as Api;

const style = (over: Style = {}): Style => ({
  fontFamily: '"Space Grotesk", sans-serif', fontSize: '16px', fontWeight: '400', lineHeight: '24px', letterSpacing: 'normal', textTransform: 'none',
  color: 'rgb(1, 2, 3)', backgroundColor: 'rgba(0, 0, 0, 0)', padding: '0px 0px 0px 0px', margin: '0px 0px 0px 0px', gap: 'normal normal',
  border: '0px none rgb(0, 0, 0)', borderRadius: '0px', ...over,
});
const rawBlock = (name: string, over: Partial<RawBlock> = {}): RawBlock => ({
  name, x: 100, width: 1200, columns: 3, charts: 2, sparks: 0, legendItems: 3, marks: { kpi: 0 }, texts: ['Heading 12'], styles: { root: style() }, ...over,
});
const raw = (blocks: RawBlock[], w = 1440) => ({ viewport: { w, h: 900 }, blocks });
const fp = (blocks: RawBlock[], w = 1440): Fingerprint => api.normalize(raw(blocks, w));

describe('fingerprint.js: normalization', () => {
  it('masks the digits of a text and keeps the words', () => {
    expect(api.maskText('Supply 1,234.5M')).toBe('Supply #');
    expect(api.maskText('  last   7 days ')).toBe('last # days');
    expect(api.maskText('/// 02')).toBe('/// #');
    expect(api.maskText('+0.12% 1d')).toBe('#% #d');
    expect(api.maskText('−3.4% 7d')).toBe('#% #d');
    expect(api.maskText('in 2026.')).toBe('in #.');
    expect(api.maskText('2026-04-15')).toBe('###');
    // Whole figures go: their sign, magnitude suffix and size never make a difference.
    expect(api.maskText('issuer mint+1.00M+1,000,000')).toBe(api.maskText('issuer mint\u2212100.00K+100,000'));
    expect(api.maskText('net+612.40M')).toBe(api.maskText('net\u22121.2K'));
    expect(api.maskText('\u25b2 3.1%')).toBe('#%');
    expect(api.maskText('7d')).toBe('#d');
    expect(api.maskText('Block\n  header')).toBe('Block header');
  });

  it('normalizes style values', () => {
    expect(api.normalizeValue('fontFamily', '"Space Grotesk", sans-serif')).toBe('space grotesk');
    expect(api.normalizeValue('fontFamily', "'IBM Plex Mono', monospace")).toBe('ibm plex mono');
    // No digit is dropped before the tolerance is applied.
    expect(api.normalizeValue('fontSize', '12.3456px')).toBe('12.3456px');
    expect(api.normalizeValue('fontSize', '12.001px')).toBe('12.001px');
    expect(api.normalizeValue('padding', '0.05px  8px')).toBe('0.05px 8px');
    expect(api.normalizeValue('color', 'rgb(182, 154, 255)')).toBe('rgb(182, 154, 255)');
  });

  it('treats pixel values closer than 2 px as equal and the rest not', () => {
    expect(api.sameValue('12px', '13.9px')).toBe(true);
    expect(api.sameValue('12px', '14px')).toBe(false);
    expect(api.sameValue('8px 12px', '9px 12px')).toBe(true);
    expect(api.sameValue('8px 12px', '8px 14px')).toBe(false);
    expect(api.sameValue('8px 12px', '8px')).toBe(false);
    expect(api.sameValue('rgb(1, 2, 3)', 'rgb(1, 2, 3)')).toBe(true);
    expect(api.sameValue('rgb(1, 2, 3)', 'rgb(1, 2, 4)')).toBe(false);
    expect(api.sameValue(100, 101)).toBe(true);
    expect(api.sameValue(100, 102)).toBe(false);
    expect(api.sameValue('700', '600')).toBe(false);
  });

  it('names a repeated block once more with a suffix, masks texts and keeps the box exact', () => {
    const result = fp([rawBlock('drivers', { x: 100.4, width: 1199.6, texts: ['Day 5', '  ', 'Mint 1,000'] }), rawBlock('drivers')]);
    expect(result.order).toEqual(['drivers', 'drivers#2']);
    expect(result.blocks.drivers).toMatchObject({ x: 100.4, width: 1199.6, texts: ['Day #', 'Mint #'] });
    expect(result.viewport).toEqual({ w: 1440, h: 900 });
  });
});

describe('fingerprint.js: comparison', () => {
  const design = () => fp([rawBlock('header', { texts: ['Supply 5', 'Mint'] }), rawBlock('day-equation'), rawBlock('status')]);

  it('finds nothing in two equal fingerprints, whatever their numbers', () => {
    const page = fp([rawBlock('header', { texts: ['Supply 9,999', 'Mint'] }), rawBlock('day-equation'), rawBlock('status')]);
    expect(api.diff(design(), page)).toEqual({ diffs: [], total: 0, notInMockup: [] });
  });

  it('reports a style that differs, with the value of each side', () => {
    const page = fp([rawBlock('header', { texts: ['Supply 5', 'Mint'], styles: { root: style({ fontSize: '14px', color: 'rgb(9, 9, 9)' }) } }), rawBlock('day-equation'), rawBlock('status')]);
    expect(api.diff(design(), page).diffs).toEqual([
      { block: 'header', property: 'root.fontSize', design: '16px', page: '14px' },
      { block: 'header', property: 'root.color', design: 'rgb(1, 2, 3)', page: 'rgb(9, 9, 9)' },
    ]);
  });

  it('ignores a pixel difference under 2 px and flags 2 px', () => {
    const near = fp([rawBlock('header', { texts: ['Supply 5', 'Mint'], x: 101, width: 1201 }), rawBlock('day-equation'), rawBlock('status')]);
    expect(api.diff(design(), near).total).toBe(0);
    const far = fp([rawBlock('header', { texts: ['Supply 5', 'Mint'], x: 102, width: 1196 }), rawBlock('day-equation'), rawBlock('status')]);
    expect(api.diff(design(), far).diffs).toEqual([
      { block: 'header', property: 'x', design: '100px', page: '102px' },
      { block: 'header', property: 'width', design: '1200px', page: '1196px' },
    ]);
  });

  it('compares counts exactly: one column more or one chart less is a difference', () => {
    const page = fp([rawBlock('header', { texts: ['Supply 5', 'Mint'], columns: 4, charts: 1, legendItems: 2, sparks: 1, marks: { kpi: 5 } }), rawBlock('day-equation'), rawBlock('status')]);
    expect(api.diff(design(), page).diffs.map((entry) => [entry.property, entry.design, entry.page])).toEqual([
      ['columns', '3', '4'], ['charts', '2', '1'], ['sparks', '0', '1'], ['legendItems', '3', '2'], ['marks.kpi', '0', '5'],
    ]);
  });

  it('reports texts that exist on one side only, as a multiset', () => {
    const page = fp([rawBlock('header', { texts: ['Supply 5', 'Supply 6', 'Burn'] }), rawBlock('day-equation'), rawBlock('status')]);
    expect(api.diff(design(), page).diffs).toEqual([{ block: 'header', property: 'texts', design: 'Mint', page: 'Supply # | Burn' }]);
  });

  it('reports a block of the mockup that the page lacks, and a page block that the mockup does not draw', () => {
    const page = fp([rawBlock('header', { texts: ['Supply 5', 'Mint'] }), rawBlock('status'), rawBlock('feed')]);
    const result = api.diff(design(), page);
    expect(result.diffs).toEqual([
      { block: 'day-equation', property: 'presence', design: 'present', page: 'absent' },
      { block: 'feed', property: 'presence', design: 'absent', page: 'present' },
    ]);
    expect(result.notInMockup).toEqual(['feed']);
  });

  it('does not let a page with extra blocks pass against a partial mockup', () => {
    const partial = fp([rawBlock('header')]);
    const full = fp([rawBlock('header'), rawBlock('feed')]);
    expect(api.diff(partial, full)).toMatchObject({ total: 1, diffs: [{ block: 'feed', property: 'presence', design: 'absent', page: 'present' }] });
  });

  it('applies the 2 px tolerance to the exact geometry, not to rounded values', () => {
    expect(api.diff(fp([rawBlock('header', { x: 100 })]), fp([rawBlock('header', { x: 101.999 })])).total).toBe(0);
    expect(api.diff(fp([rawBlock('header', { x: 100 })]), fp([rawBlock('header', { x: 102.001 })])).total).toBe(1);
    const sized = (size: string) => fp([rawBlock('header', { styles: { root: style({ fontSize: size }) } })]);
    expect(api.diff(sized('12.001px'), sized('13.999px')).total).toBe(0);
    expect(api.diff(sized('12.001px'), sized('14px')).total).toBe(0);
    expect(api.diff(sized('12px'), sized('14.001px')).total).toBe(1);
    const near = (x: number, width: number) => fp([rawBlock('header', { x, width })]);
    expect(api.diff(near(100, 1200), near(101.6, 1198.5)).total).toBe(0);
    expect(api.diff(near(100, 1200), near(102, 1200)).total).toBe(1);
    expect(api.diff(near(100.4, 1200), near(102.3, 1200)).total).toBe(0);
  });

  it('reports a different order of the blocks both have', () => {
    const page = fp([rawBlock('status'), rawBlock('header', { texts: ['Supply 5', 'Mint'] }), rawBlock('day-equation')]);
    expect(api.diff(design(), page).diffs).toEqual([{ block: '-', property: 'order', design: 'header,day-equation,status', page: 'status,header,day-equation' }]);
  });

  it('reports a style target present in the mockup and absent on the page', () => {
    const withTitle = fp([rawBlock('header', { texts: ['Supply 5', 'Mint'], styles: { root: style(), 'sec-title': style() } }), rawBlock('day-equation'), rawBlock('status')]);
    expect(api.diff(withTitle, design()).diffs).toEqual([{ block: 'header', property: 'styles.sec-title', design: 'present', page: 'absent' }]);
    expect(api.diff(design(), withTitle).total).toBe(0);
  });

  it('lists at most 200 differences and counts all of them', () => {
    expect(api.LIMIT).toBe(200);
    const many = (size: string) => fp(Array.from({ length: 6 }, (_, index) => rawBlock(`b${index}`, { styles: { root: style({ fontSize: size, fontWeight: size === '16px' ? '400' : '700', color: size === '16px' ? 'rgb(1, 2, 3)' : 'rgb(4, 5, 6)' }) } })));
    const result = api.diff(many('16px'), many('20px'));
    expect(result.total).toBe(18);
    expect(result.diffs).toHaveLength(18);
    const huge = (value: string) => fp(Array.from({ length: 120 }, (_, index) => rawBlock(`b${index}`, { styles: { root: style({ fontSize: value, color: value === '16px' ? 'rgb(1, 2, 3)' : 'rgb(4, 5, 6)' }) } })));
    const bigger = api.diff(huge('16px'), huge('20px'));
    expect(bigger.total).toBe(240);
    expect(bigger.diffs).toHaveLength(api.LIMIT);
  });
});

describe('fingerprint.js: the two runs in one tab', () => {
  function tab(blocks: RawBlock[], name: { value: unknown }, w = 1440) {
    return () => fingerprint({ env: { collect: () => raw(blocks, w), getName: () => name.value, setName: (value: string) => { name.value = value; } } });
  }

  it('stores the page on the first run and compares the mockup on the second', () => {
    const name = { value: '' as unknown };
    const first = tab([rawBlock('header', { styles: { root: style({ fontSize: '14px' }) } }), rawBlock('feed')], name)();
    expect(first).toMatchObject({ mode: 'stored', blocks: ['header', 'feed'], viewport: { w: 1440, h: 900 } });
    expect(String(name.value).startsWith('__bt-fingerprint:')).toBe(true);
    const second = tab([rawBlock('header')], name)();
    expect(second).toMatchObject({ mode: 'compared', mockupBlocks: ['header'], pageBlocks: ['header', 'feed'], notInMockup: ['feed'], total: 2 });
    expect((second.diffs as Diff[]).find((entry) => entry.property === 'presence')).toEqual({ block: 'feed', property: 'presence', design: 'absent', page: 'present' });
    expect((second.diffs as Diff[]).find((entry) => entry.property === 'root.fontSize')).toEqual({ block: 'header', property: 'root.fontSize', design: '16px', page: '14px' });
    expect(name.value).toBe('');
  });

  it('treats a foreign window.name as empty and stores over it', () => {
    const name = { value: 'something else' as unknown };
    expect(tab([rawBlock('header')], name)()).toMatchObject({ mode: 'stored' });
    expect(String(name.value).startsWith('__bt-fingerprint:')).toBe(true);
  });

  it('refuses to compare two different widths', () => {
    const name = { value: '' as unknown };
    tab([rawBlock('header')], name, 1440)();
    expect(tab([rawBlock('header')], name, 375)()).toMatchObject({ mode: 'error', error: 'viewport width differs: page 1440, mockup 375' });
    expect(name.value).toBe('');
  });
});

describe('fingerprint.js: the source', () => {
  it('is one function expression that needs no argument', () => {
    expect(fingerprintFunction(source).startsWith('(hooks) => {')).toBe(true);
    expect(fingerprintFunction(source)).not.toContain('eslint');
    expect(source).not.toContain('9222');
    expect(source).toContain("'ab-eq'");
    expect(source).toContain("'day-equation'");
  });
});

describe('fingerprint.js: what is compared', () => {
  it('writes apostrophes one way', () => {
    expect(api.maskText('chain’s last day')).toBe("chain's last day");
    expect(api.maskText('chain‘s last day')).toBe(api.maskText("chain's last day"));
  });

  it('reads no table, figure or definition tags as texts, and the records reason as the n/a reason', () => {
    const selectors = api.TEXT_SELECTOR.split(',');
    for (const gone of ['th', 'h3', 'h4', 'h5', 'figcaption', 'dt']) expect(selectors, gone).not.toContain(gone);
    expect(selectors).toEqual(expect.arrayContaining(['h1', 'h2', '.na-why', '.rec-reason', '.tag', '.chip']));
  });

  it('counts only the kpi marks', () => {
    expect(api.MARKS).toEqual(['kpi']);
    const result = fp([rawBlock('drivers', { marks: { kpi: 2, chainState: 9, flow: 368 } as RawBlock['marks'] })]);
    expect(result.blocks.drivers?.marks).toEqual({ kpi: 2 });
    const one = fp([rawBlock('drivers', { marks: { kpi: 2, chainState: 1, flow: 5 } as RawBlock['marks'] })]);
    const other = fp([rawBlock('drivers', { marks: { kpi: 2, chainState: 0, flow: 30 } as RawBlock['marks'] })]);
    expect(api.diff(one, other).total).toBe(0);
  });

  it('has the targets of the agreed table', () => {
    const targets = Object.fromEntries(api.TARGETS);
    expect(targets['kpi-value']).toBe('.kpi, .rec-kpi');
    expect(targets['kpi-full']).toBe('.full, .rec-full');
    expect(targets.card).toBe('.card:not([data-delayed]):not([data-unreconciled]):not([data-chain-state="delayed"]):not([data-chain-state="unreconciled"])');
    for (const variant of ['cctp', 'unrec', 'delayed', 'nodata', 'peer', 'unpaired']) expect(targets[`tag.${variant}`], variant).toBe(`.tag.${variant}`);
    expect(targets.tag).toBeUndefined();
    expect(api.TARGETS.map(([name]) => name)).toHaveLength(new Set(api.TARGETS.map(([name]) => name)).size);
  });

  const withTarget = (name: string) => fp([rawBlock('feed', { styles: { root: style(), [name]: style() } })]);
  const without = () => fp([rawBlock('feed')]);

  it.each(['tag.cctp', 'tag.unrec', 'tag.delayed', 'tag.nodata', 'tag.peer', 'tag.unpaired', 'chain', 'chip', 'qnote', 'card', 'link', 'th', 'td'])(
    'does not report %s as present in the mockup and absent on the page',
    (target) => {
      expect(api.diff(withTarget(target), without())).toMatchObject({ total: 0, diffs: [] });
    },
  );

  it.each(['sec-label', 'sec-ix', 'sec-title', 'sec-caption', 'kpi-card', 'kpi-value', 'kpi-full', 'kpi-change', 'legend'])('reports %s as present in the mockup and absent on the page', (target) => {
    expect(api.diff(withTarget(target), without()).diffs).toEqual([{ block: 'feed', property: `styles.${target}`, design: 'present', page: 'absent' }]);
  });

  it('still compares the styles of a data-dependent target that both sides have', () => {
    const page = fp([rawBlock('feed', { styles: { root: style(), 'tag.cctp': style({ borderRadius: '4px' }) } })]);
    const design = fp([rawBlock('feed', { styles: { root: style(), 'tag.cctp': style({ borderRadius: '999px' }) } })]);
    expect(api.diff(design, page).diffs).toEqual([{ block: 'feed', property: 'tag.cctp.borderRadius', design: '999px', page: '4px' }]);
  });
});

// A tiny stand-in for the DOM: elements answer querySelector and querySelectorAll by the exact selector
// string. It checks the wiring of collect (which selector is asked, what is read from which element); that a
// selector matches the right element of the page and of the mockups is checked against their sources.
describe('fingerprint.js: collect', () => {
  interface FakeEl {
    attrs?: Record<string, string>;
    classes?: string[];
    box?: { x: number; width: number };
    cs?: Record<string, string>;
    one?: Record<string, FakeEl>;
    all?: Record<string, FakeEl[]>;
    within?: FakeEl[];
    closest?: Record<string, FakeEl>;
    is?: string[];
    text?: string;
  }
  const computed = (over: Record<string, string> = {}) => ({
    fontFamily: 'sans-serif', fontSize: '16px', fontWeight: '400', lineHeight: '24px', letterSpacing: 'normal', textTransform: 'none', color: 'rgb(1, 2, 3)', backgroundColor: 'rgba(0, 0, 0, 0)',
    paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px', marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px',
    rowGap: 'normal', columnGap: 'normal', borderTopWidth: '0px', borderTopStyle: 'none', borderTopColor: 'rgb(0, 0, 0)', borderTopLeftRadius: '0px', display: 'block', gridTemplateColumns: 'none', ...over,
  });
  const asked: string[] = [];
  const wrap = (spec: FakeEl): Record<string, unknown> => {
    const node: Record<string, unknown> = {
      spec,
      getAttribute: (name: string) => spec.attrs?.[name] ?? null,
      classList: { contains: (name: string) => spec.classes?.includes(name) ?? false },
      getBoundingClientRect: () => ({ x: spec.box?.x ?? 0, width: spec.box?.width ?? 0, height: 100 }),
      querySelector: (selector: string) => {
        asked.push(selector);
        const found = spec.one?.[selector];
        return found ? wrap(found) : null;
      },
      querySelectorAll: (selector: string) => {
        asked.push(selector);
        return selector === '*' ? (spec.within ?? []).map(wrap) : (spec.all?.[selector] ?? []).map(wrap);
      },
      closest: (selector: string) => (spec.closest?.[selector] ? wrap(spec.closest[selector]) : null),
      matches: (selector: string) => spec.is?.includes(selector) ?? false,
      cloneNode: () => ({ querySelectorAll: () => [], textContent: spec.text ?? '' }),
    };
    return node;
  };
  const stored = (blocks: FakeEl[]) => {
    asked.length = 0;
    const win = { name: '', scrollX: 0, innerWidth: 1440, innerHeight: 900 };
    const context = vm.createContext({
      window: win,
      document: { querySelectorAll: () => blocks.map(wrap) },
      getComputedStyle: (node: { spec: FakeEl }) => node.spec.cs ?? computed(),
    });
    const run = vm.runInContext(`(${fingerprintFunction(source)})`, context) as Run;
    expect(run(undefined)).toMatchObject({ mode: 'stored' });
    return JSON.parse(win.name.slice('__bt-fingerprint:'.length)) as Fingerprint;
  };
  const block = (name: string, over: FakeEl = {}): FakeEl => ({ attrs: { 'data-block': name }, box: { x: 0, width: 1200 }, ...over });

  it('does not look at flow or chain-state marks, and counts kpi marks', () => {
    const result = stored([block('drivers', { all: { '[data-kpi]': [{}, {}], '[data-flow]': Array.from({ length: 368 }, () => ({})), '[data-chain-state]': [{}] } })]);
    expect(result.blocks.drivers?.marks).toEqual({ kpi: 2 });
    expect(asked).not.toContain('[data-flow]');
    expect(asked).not.toContain('[data-chain-state]');
  });

  it('takes the margin of a notice from the list that wraps it', () => {
    const wrapper: FakeEl = { cs: computed({ marginBottom: '20px' }) };
    const note: FakeEl = { cs: computed({ marginBottom: '0px', fontSize: '13px' }), closest: { '.qnotes': wrapper } };
    const result = stored([block('header', { one: { '.qnote': note } })]);
    const styles = result.blocks.header?.styles.qnote;
    expect(styles?.margin).toBe('0px 0px 20px 0px');
    expect(styles?.fontSize).toBe('13px');
    const bare = stored([block('header', { one: { '.qnote': { cs: computed({ marginBottom: '20px' }) } } })]);
    expect(bare.blocks.header?.styles.qnote?.margin).toBe('0px 0px 20px 0px');
  });

  it('skips the notices list when it looks for the first grid', () => {
    const qnotes: FakeEl = { cs: computed({ display: 'grid', gridTemplateColumns: '600px' }), is: ['.qnotes'] };
    const hero: FakeEl = { cs: computed({ display: 'grid', gridTemplateColumns: '300px 300px' }) };
    expect(stored([block('header', { within: [qnotes, hero] })]).blocks.header?.columns).toBe(2);
    expect(stored([block('header', { within: [qnotes] })]).blocks.header?.columns).toBe(0);
    expect(stored([block('header', { within: [hero, qnotes] })]).blocks.header?.columns).toBe(2);
  });

  it('names the block of the empty page header, as the mockup does', () => {
    const result = stored([block('no-figures'), block('status')]);
    expect(result.order).toEqual(['header', 'status']);
    expect(result.blocks.header).toBeDefined();
    expect(result.blocks['no-figures']).toBeUndefined();
    expect(stored([block('drivers', { classes: ['ab-eq'] })]).order).toEqual(['day-equation']);
  });

  it('measures the record figures (.rec-kpi) as the big figure of the mockup (.kpi)', () => {
    const big = (size: string): FakeEl => ({ cs: computed({ fontSize: size }) });
    const selector = Object.fromEntries(api.TARGETS)['kpi-value'] ?? '';
    const collected = (size: string) => stored([block('records', { one: { [selector]: big(size) } })]);
    const design = collected('44px');
    expect(api.diff(design, collected('44px'))).toMatchObject({ total: 0 });
    expect(api.diff(design, collected('30px')).diffs).toEqual([{ block: 'records', property: 'kpi-value.fontSize', design: '44px', page: '30px' }]);
    expect(api.diff(design, stored([block('records')])).diffs).toEqual([{ block: 'records', property: 'styles.kpi-value', design: 'present', page: 'absent' }]);
  });

  it('asks for every target of the table', () => {
    stored([block('feed')]);
    for (const [, selector] of api.TARGETS) expect(asked, selector).toContain(selector);
  });
});

describe('the guard against hand-altered fingerprint data', () => {
  const vocabulary = fingerprintVocabulary(source);
  const problem = (property: string, design: string, page: string) => fingerprintProblem({ property, design, page }, vocabulary);

  it('takes its names from fingerprint.js itself', () => {
    expect(vocabulary.props).toEqual(api.PROPS);
    expect(vocabulary.targets).toEqual(['root', ...api.TARGETS.map(([name]) => name)]);
    expect(vocabulary.fixed).toEqual(expect.arrayContaining(['presence', 'order', 'texts', 'x', 'width', 'columns', 'charts', 'sparks', 'legendItems', 'marks.kpi']));
  });

  it('lets through every difference the real fingerprint produces', () => {
    const loud = style({
      fontFamily: 'Other, serif', fontSize: '12px', fontWeight: '700', lineHeight: 'normal', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgb(9, 9, 9)',
      backgroundColor: 'rgb(1, 1, 1)', padding: '1px 8px 1px 8px', margin: '0px 0px 20px 0px', gap: '12px', border: '1px solid rgb(0, 0, 0)', borderRadius: '8px 4px',
    });
    const design = fp([
      rawBlock('header', { texts: ['A'], x: 12.3456789, width: 1200.123456, styles: { root: style(), 'sec-title': style(), 'kpi-card': style(), 'tag.cctp': style(), 'tag.unrec': style() } }),
      rawBlock('feed'), rawBlock('gone'),
    ]);
    const page = fp([
      rawBlock('feed'),
      rawBlock('header', { texts: ['B', 'C'], x: 40, width: 1100, columns: 1, charts: 0, sparks: 2, legendItems: 1, marks: { kpi: 3 }, styles: { root: loud, 'sec-title': loud, 'tag.cctp': loud, 'tag.unrec': loud } }),
      rawBlock('extra'),
    ]);
    const { diffs } = api.diff(design, page);
    const properties = new Set(diffs.map((entry) => entry.property));
    for (const wanted of ['presence', 'order', 'x', 'width', 'columns', 'marks.kpi', 'texts', 'root.padding', 'root.margin', 'root.gap', 'root.border', 'root.borderRadius', 'sec-title.padding', 'styles.kpi-card', 'tag.cctp.borderRadius', 'tag.unrec.padding']) {
      expect(properties, wanted).toContain(wanted);
    }
    expect(diffs.length).toBeGreaterThan(20);
    for (const entry of diffs) expect(fingerprintProblem(entry, vocabulary), `${entry.block} ${entry.property} ${entry.design} / ${entry.page}`).toBeNull();
  });

  it('rejects a padding or margin that is not the 4-part form of four(...), on either side', () => {
    expect(problem('root.padding', '12px 20px 20px', '12px 20px 12px 20px')).toContain('design value "12px 20px 20px" has 3 parts');
    expect(problem('kpi-card.margin', '0px 0px 0px 0px', '0px 0px')).toContain('page value');
    expect(problem('sec-title.margin', '0px 0px 0px 0px 0px', '0px 0px 0px 0px')).toContain('5 parts');
    expect(problem('root.padding', '0px 0px 0px 0px', '0px 0px 0px 0px')).toBeNull();
    expect(problem('root.padding', '0px  0px 0px', '0px 0px 0px 0px')).toContain('parts');
    expect(problem('root.padding', '0px 0px 0px 0px', ' 0px 0px 0px')).toContain('parts');
    expect(problem('tag.cctp.margin', '0px 0px 0px', '0px 0px 0px 0px')).toContain('3 parts');
  });

  it('rejects an x or width that show() cannot have produced', () => {
    expect(problem('x', '12.34px', '40px')).toBeNull();
    expect(problem('width', '12.345px', '40px')).toContain('not a pixel number');
    expect(problem('x', '12', '40px')).toContain('not a pixel number');
  });

  it('rejects a property the fingerprint never emits', () => {
    expect(problem('padding', 'a', 'b')).toContain('not a property');
    expect(problem('root.paddng', 'a', 'b')).toContain('not a property');
    expect(problem('nothing.padding', 'a', 'b')).toContain('not a property');
    expect(problem('styles.nothing', 'present', 'absent')).toContain('unknown target');
    expect(problem('marks.flow', '1', '2')).toContain('not a property');
  });

  it('checks only the name of raw computed values such as gap, border and radius', () => {
    expect(problem('root.gap', 'normal', '12px')).toBeNull();
    expect(problem('card.border', '0px none', 'x')).toBeNull();
    expect(problem('root.borderRadius', '1px 2px 3px', '8px')).toBeNull();
  });
});
