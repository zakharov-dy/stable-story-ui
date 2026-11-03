// Shared opaque event cursor. No platform-specific APIs.
import { z } from 'zod';
import { Amount, Day, FLOWS, IsoDateTime } from './primitives.ts';
import type { Flow } from './primitives.ts';
import type { EventsSort } from './query.ts';

export interface EventsCursorFilters {
  asset: string;
  sort: EventsSort;
  /** Expanded enabled selection; an empty list here means no selected chains. */
  chains: readonly string[];
  /** Expanded flow selection, not the empty query shorthand for all. */
  flows: readonly Flow[];
  /** Original request bounds, never the bounds resolved from current coverage. */
  from?: string | null;
  to?: string | null;
}

interface EventPosition {
  time: string;
  chain: string;
  txHash: string;
  logIndex: number;
}
export type EventsCursorPosition =
  | (EventPosition & { sort: 'amount'; amount: string })
  | (EventPosition & { sort: 'time' });

export class CursorError extends Error {
  override name = 'CursorError';
  readonly code = 'invalid_cursor';

  constructor(message = 'Invalid event cursor') {
    super(message);
  }
}

/** Collision-free canonical fingerprint. Callers resolve registry selections first. */
export function createEventsCursorFingerprint(filters: EventsCursorFilters): string {
  const from = filters.from ?? null;
  const to = filters.to ?? null;
  if ((from !== null && !Day.safeParse(from).success) || (to !== null && !Day.safeParse(to).success)) {
    throw new CursorError('Invalid cursor request dates');
  }
  return JSON.stringify([
    filters.asset,
    filters.sort,
    [...new Set(filters.chains)].sort(),
    FLOWS.filter((flow) => filters.flows.includes(flow)),
    from,
    to,
  ]);
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function encodeBase64Url(value: string): string {
  // ECMAScript URI encoding supplies UTF-8 without Buffer, btoa or TextEncoder.
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    result += ALPHABET[a >> 2];
    result += ALPHABET[((a & 3) << 4) | (b >> 4)];
    if (index + 1 < bytes.length) {
      result += ALPHABET[((b & 15) << 2) | (c >> 6)];
    }
    if (index + 2 < bytes.length) {
      result += ALPHABET[c & 63];
    }
  }
  return result;
}

function decodeBase64Url(token: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(token) || token.length % 4 === 1) {
    throw new CursorError();
  }
  let bits = 0;
  let pending = 0;
  let encoded = '';
  for (const char of token) {
    pending = (pending << 6) | ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      const byte = (pending >> bits) & 255;
      encoded += `%${byte.toString(16).padStart(2, '0')}`;
      pending &= (1 << bits) - 1;
    }
  }
  const value = decodeURIComponent(encoded);
  if (encodeBase64Url(value) !== token) {
    throw new CursorError('Noncanonical cursor encoding');
  }
  return value;
}

const PositionKeys = [
  IsoDateTime,
  z.string().min(1),
  z.string().regex(/^0x[0-9a-f]{64}$/),
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
] as const;
const TimeKeys = z.tuple(PositionKeys);
const AmountKeys = z.tuple([Amount.refine((value) => !value.startsWith('-')), ...PositionKeys]);

export function encodeEventsCursor(position: EventsCursorPosition, fingerprint: string): string {
  const rest = [position.time, position.chain, position.txHash.toLowerCase(), position.logIndex];
  const keys = position.sort === 'amount' ? [position.amount, ...rest] : rest;
  const valid = (position.sort === 'amount' ? AmountKeys : TimeKeys).safeParse(keys);
  if (!valid.success) {
    throw new CursorError('Invalid cursor position');
  }
  return encodeBase64Url(JSON.stringify([1, fingerprint, valid.data]));
}

export function decodeEventsCursor(
  token: string,
  fingerprint: string,
  sort: EventsSort,
): EventsCursorPosition {
  try {
    const value: unknown = JSON.parse(decodeBase64Url(token));
    const envelope = z.tuple([z.literal(1), z.literal(fingerprint), z.unknown()]).safeParse(value);
    if (!envelope.success) {
      throw new CursorError('Invalid cursor version or filter fingerprint');
    }
    if (sort === 'amount') {
      const keys = AmountKeys.safeParse(envelope.data[2]);
      if (!keys.success) {
        throw new CursorError();
      }
      const [amount, time, chain, txHash, logIndex] = keys.data;
      return { sort, amount, time, chain, txHash, logIndex };
    }
    const keys = TimeKeys.safeParse(envelope.data[2]);
    if (!keys.success) {
      throw new CursorError();
    }
    const [time, chain, txHash, logIndex] = keys.data;
    return { sort, time, chain, txHash, logIndex };
  } catch (error) {
    if (error instanceof CursorError) {
      throw error;
    }
    throw new CursorError();
  }
}
