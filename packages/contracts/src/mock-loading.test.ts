import { expect, it, vi } from 'vitest';

const SERIES = {
  period: 'day', unit: 'tokens',
  buckets: [{ start: '2026-10-09', end: '2026-10-09', complete: true }],
  lines: [{ key: 'all', values: ['1000'], unreconciled: [] }],
};

it('keeps index loading out of the root import and unavailable calls', async () => {
  let loads = 0;
  vi.resetModules();
  vi.doMock('./mock-index.generated.ts', () => {
    loads += 1;
    return { index: { states: { ok: { assets: ['usdc'], chains: ['ethereum'] } }, entries: {} } };
  });
  try {
    const contracts = await import('./index.ts');
    expect(loads).toBe(0);
    await expect(contracts.createMockClient('unavailable').overview()).rejects.toMatchObject({ kind: 'transport' });
    expect(loads).toBe(0);
    await expect(contracts.createMockClient('ok').series({ metric: 'level', basis: 'count' })).rejects.toMatchObject({ status: 400 });
    expect(loads).toBe(1);
    await expect(contracts.createMockClient('ok').overview()).rejects.toMatchObject({ code: 'mock_query_unsupported' });
    expect(loads).toBe(1);
  } finally {
    vi.doUnmock('./mock-index.generated.ts');
    vi.resetModules();
  }
});

it('loads only the response file of the served query, and hands out copies of it', async () => {
  const loaded: string[] = [];
  vi.resetModules();
  const contracts = await import('./index.ts');
  const key = `ok:${JSON.stringify(['series', { ...contracts.endpoints.series.query.parse({}), chains: ['ethereum'] }])}`;
  const shared = structuredClone(SERIES);
  vi.doMock('./mock-index.generated.ts', () => ({
    index: {
      states: { ok: { assets: ['usdc'], chains: ['ethereum'] } },
      entries: {
        [key]: () => { loaded.push('served'); return Promise.resolve({ default: shared }); },
        other: () => { loaded.push('other'); return Promise.resolve({ default: {} }); },
      },
    },
  }));
  try {
    const client = contracts.createMockClient('ok');
    const first = await client.series();
    expect(first).toEqual(SERIES);
    first.buckets.pop();
    expect(await client.series()).toEqual(SERIES);
    expect(shared).toEqual(SERIES);
    expect(loaded).toEqual(['served', 'served']);
  } finally {
    vi.doUnmock('./mock-index.generated.ts');
    vi.resetModules();
  }
});

it('turns a failed response load into a transport error and retries a failed index load', async () => {
  let indexLoads = 0;
  vi.resetModules();
  vi.doMock('./mock-index.generated.ts', () => {
    indexLoads += 1;
    throw new Error('Temporary index load failure');
  });
  try {
    const contracts = await import('./index.ts');
    const client = contracts.createMockClient('ok');
    await Promise.all([
      expect(client.series()).rejects.toMatchObject({ kind: 'transport' }),
      expect(client.series()).rejects.toMatchObject({ kind: 'transport' }),
    ]);
    expect(indexLoads).toBe(1);
    const key = `ok:${JSON.stringify(['series', { ...contracts.endpoints.series.query.parse({}), chains: ['ethereum'] }])}`;
    let fileLoads = 0;
    // Restore the loader without replacing the existing client or its module-level cache.
    vi.doMock('./mock-index.generated.ts', () => {
      indexLoads += 1;
      return {
        index: {
          states: { ok: { assets: ['usdc'], chains: ['ethereum'] } },
          entries: { [key]: () => (fileLoads++ === 0 ? Promise.reject(new Error('file gone')) : Promise.resolve({ default: SERIES })) },
        },
      };
    });
    await expect(client.series()).rejects.toMatchObject({ kind: 'transport' });
    await expect(Promise.all([client.series(), client.series()])).resolves.toEqual([SERIES, SERIES]);
    expect(indexLoads).toBe(2);
  } finally {
    vi.doUnmock('./mock-index.generated.ts');
    vi.resetModules();
  }
});
