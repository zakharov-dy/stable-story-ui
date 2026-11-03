import { describe, expect, it } from 'vitest';
import { OVERVIEW_DOCUMENT, PublicationCurrent, PublicationManifest } from './index.ts';

const version = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const digest = 'a'.repeat(64);
const time = '2026-11-02T06:00:00.000Z';
const pointer = () => ({ formatVersion: 1 as const, version, previous: null as string | null, manifestSha256: digest, publishedAt: time });
const manifest = () => ({ formatVersion: 1 as const, version, builtAt: time, stateSha256: digest,
  documents: [{ key: `versions/${version}/${OVERVIEW_DOCUMENT}`, byteLength: 123, sha256: digest, asOf: '2026-11-01' as string | null, generatedAt: time }],
});
const paths = (result: { error?: { issues: { path: PropertyKey[] }[] } }) => result.error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('publication format v1', () => {
  it('accepts first/subsequent pointers, a closed day and the empty overview metadata', () => {
    expect(PublicationCurrent.parse(pointer()).previous).toBeNull();
    expect(PublicationCurrent.parse({ ...pointer(), previous: other }).previous).toBe(other);
    expect(PublicationManifest.parse(manifest()).documents[0].asOf).toBe('2026-11-01');
    const empty = manifest(); empty.documents[0].asOf = null;
    expect(PublicationManifest.parse(empty).documents[0].asOf).toBeNull();
  });

  it.each([
    { label: 'self previous', change: { previous: version }, path: 'previous' },
    { label: 'unsafe version', change: { version: '../x' }, path: 'version' },
    { label: 'uppercase version', change: { version: version.toUpperCase() }, path: 'version' },
    { label: 'bad previous', change: { previous: 'invalid' }, path: 'previous' },
    { label: 'wrong format', change: { formatVersion: 2 }, path: 'formatVersion' },
    { label: 'bad digest', change: { manifestSha256: 'A'.repeat(64) }, path: 'manifestSha256' },
    { label: 'non-UTC timestamp', change: { publishedAt: '2026-11-02T06:00:00+01:00' }, path: 'publishedAt' },
    { label: 'extra field', change: { body: {} }, path: '' },
  ])('rejects pointer: $label at $path', ({ change, path }) => {
    expect(paths(PublicationCurrent.safeParse({ ...pointer(), ...change }))).toContain(path);
  });

  it.each([
    { label: 'version mismatch', change: { key: `versions/${other}/${OVERVIEW_DOCUMENT}` }, path: 'key' },
    { label: 'another document', change: { key: `versions/${version}/events.json` }, path: 'key' },
    { label: 'path traversal', change: { key: `versions/${version}/../${OVERVIEW_DOCUMENT}` }, path: 'key' },
    { label: 'clock mismatch', change: { generatedAt: '2026-11-02T07:00:00.000Z' }, path: 'generatedAt' },
    { label: 'invalid calendar day', change: { asOf: '2026-02-30' }, path: 'asOf' },
    { label: 'zero length', change: { byteLength: 0 }, path: 'byteLength' },
    { label: 'fractional length', change: { byteLength: 1.5 }, path: 'byteLength' },
    { label: 'unsafe integer length', change: { byteLength: Number.MAX_SAFE_INTEGER + 1 }, path: 'byteLength' },
    { label: 'bad body hash', change: { sha256: 'short' }, path: 'sha256' },
    { label: 'extra body metadata', change: { secret: 'unexpected' }, path: '' },
  ])('rejects manifest document: $label', ({ change, path }) => {
    const value = manifest(); Object.assign(value.documents[0], change);
    expect(paths(PublicationManifest.safeParse(value))).toContain(`documents.0${path ? '.' + path : ''}`);
  });

  it.each([
    { change: { documents: [] }, path: 'documents' },
    { change: { documents: [...manifest().documents, ...manifest().documents] }, path: 'documents' },
    { change: { stateSha256: 'bad' }, path: 'stateSha256' },
    { change: { builtAt: 'not-a-time' }, path: 'builtAt' },
    { change: { version: '../unsafe' }, path: 'version' },
    { change: { formatVersion: 2 }, path: 'formatVersion' },
    { change: { unexpected: true }, path: '' },
  ])('rejects manifest at $path', ({ change, path }) => {
    expect(paths(PublicationManifest.safeParse({ ...manifest(), ...change }))).toContain(path);
  });
});
