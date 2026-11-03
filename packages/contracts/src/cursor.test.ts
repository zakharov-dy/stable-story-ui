import { describe, expect, it } from 'vitest';
import { createEventsCursorFingerprint, CursorError, decodeEventsCursor, encodeEventsCursor } from './cursor.ts';
import type { EventsCursorFilters, EventsCursorPosition } from './cursor.ts';

const position = {
  time: '2026-10-09T00:00:00.000Z', chain: 'ethereum', txHash: `0x${'ab'.repeat(32)}`, logIndex: 2,
};
const filters: EventsCursorFilters = {
  asset: 'usdc', sort: 'amount', chains: ['ethereum', 'base'], flows: ['bridge_in', 'issuer_mint'],
};
const AMOUNT_TOKEN = 'WzEsImZpbHRlcnMiLFsiMTAwIiwiMjAyNi0xMC0wOVQwMDowMDowMC4wMDBaIiwiZXRoZXJldW0iLCIweGFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWIiLDJdXQ';
const TIME_TOKEN = 'WzEsImZpbHRlcnMiLFsiMjAyNi0xMC0wOVQwMDowMDowMC4wMDBaIiwiZXRoZXJldW0iLCIweGFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWIiLDJdXQ';

describe('event cursor v1', () => {
  it.each<[{ sort: 'amount'; amount: string } | { sort: 'time' }, string]>([
    [{ sort: 'amount', amount: '100' }, AMOUNT_TOKEN],
    [{ sort: 'time' }, TIME_TOKEN],
  ])('matches an independently encoded literal token for %j', (sort, token) => {
    const value: EventsCursorPosition = { ...position, ...sort };
    expect(encodeEventsCursor(value, 'filters')).toBe(token);
    expect(decodeEventsCursor(token, 'filters', sort.sort)).toEqual(value);
  });

  it('canonicalizes duplicate/permuted selections but retains the original date bounds', () => {
    const fingerprint = createEventsCursorFingerprint(filters);
    expect(fingerprint).toBe('["usdc","amount",["base","ethereum"],["issuer_mint","bridge_in"],null,null]');
    expect(createEventsCursorFingerprint({ ...filters, chains: ['base', 'ethereum', 'base'], flows: ['issuer_mint', 'bridge_in', 'issuer_mint'] })).toBe(fingerprint);
    expect(createEventsCursorFingerprint({ ...filters, from: null, to: null })).toBe(fingerprint);
    expect(createEventsCursorFingerprint({ ...filters, from: '2026-10-03', to: '2026-10-09' })).not.toBe(fingerprint);
  });

  it.each<Partial<EventsCursorFilters>>([
    { asset: 'other' }, { chains: ['base'] }, { flows: ['bridge_out'] }, { sort: 'time' },
    { from: '2026-10-03' }, { to: '2026-10-09' },
  ])('rejects a changed fingerprint: %j', (change) => {
    const token = encodeEventsCursor({ ...position, sort: 'amount', amount: '100' }, createEventsCursorFingerprint(filters));
    expect(() => decodeEventsCursor(token, createEventsCursorFingerprint({ ...filters, ...change }), change.sort ?? 'amount')).toThrow(CursorError);
  });

  it('matches an independent Unicode token containing both base64url punctuation symbols', () => {
    const value: EventsCursorPosition = { ...position, chain: 'сеть🌍', sort: 'time' };
    const fingerprint = 'фильтры🌍a🌿';
    // Python base64.urlsafe_b64encode of compact ensure_ascii=False JSON encoded as UTF-8.
    const token = 'WzEsItGE0LjQu9GM0YLRgNGL8J-MjWHwn4y_IixbIjIwMjYtMTAtMDlUMDA6MDA6MDAuMDAwWiIsItGB0LXRgtGM8J-MjSIsIjB4YWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYmFiYWJhYiIsMl1d';
    expect(encodeEventsCursor(value, fingerprint)).toBe(token);
    expect(decodeEventsCursor(token, fingerprint, 'time')).toEqual(value);
  });

  it('normalizes hashes and preserves numeric index 10', () => {
    const value: EventsCursorPosition = { ...position, txHash: position.txHash.toUpperCase(), logIndex: 10, sort: 'time' };
    expect(decodeEventsCursor(encodeEventsCursor(value, 'f'), 'f', 'time')).toEqual({ ...value, txHash: position.txHash });
  });

  it.each(['', 'a', '***', '____', 'W10', 'WzIsImYiLFtdXQ', `${TIME_TOKEN}=`, `${TIME_TOKEN.slice(0, -1)}R`])('rejects malformed or noncanonical token %s', (token) => {
    expect(() => decodeEventsCursor(token, 'filters', 'time')).toThrow(CursorError);
  });

  it('rejects keys for the wrong sorting mode', () => {
    expect(() => decodeEventsCursor(TIME_TOKEN, 'filters', 'amount')).toThrow(CursorError);
    expect(() => decodeEventsCursor(AMOUNT_TOKEN, 'filters', 'time')).toThrow(CursorError);
  });

  it.each([
    { amount: '-1' }, { amount: '01' }, { logIndex: -1 }, { logIndex: 1.5 }, { logIndex: Number.MAX_SAFE_INTEGER + 1 },
    { time: '2026-10-09' }, { txHash: 'bad' },
  ])('rejects invalid positions %j', (change) => {
    expect(() => encodeEventsCursor({ ...position, sort: 'amount', amount: '100', ...change }, 'f')).toThrow(CursorError);
  });
});
