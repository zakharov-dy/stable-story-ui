import { describe, expect, it } from 'vitest';
import {
  checkConsole,
  checkFonts,
  checkNetwork,
  checkOverflow,
  groupProblems,
  sandboxRefusal,
} from './browser-smoke-checks.ts';

const ORIGIN = 'http://127.0.0.1:3100';
describe('console', () => {
  it('passes on logs, info and debug', () => {
    expect(
      checkConsole([
        { type: 'log', text: 'a' },
        { type: 'info', text: 'b' },
        { type: 'debug', text: 'c' },
      ]),
    ).toEqual([]);
  });
  it('fails on an error, a warning, a page error and a failed request', () => {
    const problems = checkConsole([
      { type: 'error', text: 'Failed to load resource: 404' },
      { type: 'warning', text: 'deprecated' },
      { type: 'pageerror', text: 'x is not defined' },
      { type: 'requestfailed', text: 'https://example.com/a net::ERR_FAILED' },
    ]);
    expect(problems).toHaveLength(4);
  });
  it('names a hydration error, also the minified React one of a production build', () => {
    expect(
      checkConsole([
        {
          type: 'error',
          text: 'Hydration failed because the server rendered HTML',
        },
      ])[0],
    ).toContain('hydration');
    expect(
      checkConsole([
        {
          type: 'pageerror',
          text: 'Minified React error #418; visit https://react.dev/errors/418',
        },
      ])[0],
    ).toContain('hydration');
    expect(checkConsole([{ type: 'error', text: 'other' }])[0]).not.toContain(
      'hydration',
    );
  });
});

describe('network', () => {
  const base = {
    origin: ORIGIN,
    documentStatus: 200,
    pendingRequests: [],
    requests: [`${ORIGIN}/`],
    responses: [{ url: `${ORIGIN}/`, status: 200 }],
  };
  it('passes on own-origin requests, data: and blob:', () => {
    expect(
      checkNetwork({
        ...base,
        requests: [
          `${ORIGIN}/a`,
          'data:text/plain,x',
          'blob:http://127.0.0.1:3100/uuid',
        ],
      }),
    ).toEqual([]);
  });
  it('fails on a request to another origin, also another port or host', () => {
    expect(
      checkNetwork({
        ...base,
        requests: [`${ORIGIN}/`, 'https://fonts.gstatic.com/x.woff2'],
      }),
    ).toEqual(['request to another origin: https://fonts.gstatic.com/x.woff2']);
    expect(
      checkNetwork({ ...base, requests: ['http://127.0.0.1:3101/'] }),
    ).toHaveLength(1);
    expect(
      checkNetwork({ ...base, requests: ['http://localhost:3100/'] }),
    ).toHaveLength(1);
  });
  it('fails on a 404 and a 500, naming the URL and the status', () => {
    expect(
      checkNetwork({
        ...base,
        responses: [
          ...base.responses,
          { url: `${ORIGIN}/favicon.ico`, status: 404 },
        ],
      }),
    ).toEqual([`404 for ${ORIGIN}/favicon.ico`]);
    expect(
      checkNetwork({
        ...base,
        responses: [{ url: `${ORIGIN}/api`, status: 500 }],
      }),
    ).toEqual([`500 for ${ORIGIN}/api`]);
  });
  it('lets 399 pass and requires 200 for the document', () => {
    expect(
      checkNetwork({
        ...base,
        responses: [{ url: `${ORIGIN}/r`, status: 304 }],
      }),
    ).toEqual([]);
    expect(checkNetwork({ ...base, documentStatus: 500 })).toEqual([
      'the document answered 500, expected 200',
    ]);
    expect(checkNetwork({ ...base, documentStatus: null })).toHaveLength(1);
  });
});

describe('overflow', () => {
  it('passes when equal and fails by one pixel', () => {
    expect(checkOverflow({ scrollWidth: 375, innerWidth: 375 })).toEqual([]);
    expect(checkOverflow({ scrollWidth: 376, innerWidth: 375 })).toHaveLength(
      1,
    );
  });
});

describe('fonts', () => {
  const ok = {
    fontsStatus: 'loaded',
    fontFaces: [{ family: 'A', status: 'loaded' }],
    responses: [{ url: `${ORIGIN}/m/a.woff2`, status: 200 }],
  };
  it('passes when loaded', () => {
    expect(checkFonts(ok)).toEqual([]);
  });
  it('fails on a status other than loaded, a face in error and no font file', () => {
    expect(checkFonts({ ...ok, fontsStatus: 'loading' })).toHaveLength(1);
    expect(
      checkFonts({ ...ok, fontFaces: [{ family: 'A', status: 'error' }] }),
    ).toEqual(['font face A is in error']);
    expect(checkFonts({ ...ok, responses: [] })).toEqual([
      'no .woff2 font file was loaded',
    ]);
    expect(
      checkFonts({
        ...ok,
        responses: [{ url: `${ORIGIN}/m/a.woff2`, status: 404 }],
      }),
    ).toEqual(['no .woff2 font file was loaded']);
  });
});

describe('smoke support', () => {
  it('groups repeated problems', () => {
    expect(groupProblems(['a', 'a', 'b'])).toEqual(['a (x2)', 'b']);
  });
  it('refuses unsupported sandboxes', () => {
    expect(sandboxRefusal({})).toBeNull();
    expect(
      sandboxRefusal({ BROWSER_SMOKE_UNSUPPORTED_SANDBOX: '1' }),
    ).not.toBeNull();
  });
});
