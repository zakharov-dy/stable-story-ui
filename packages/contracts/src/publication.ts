// Strict publication format v1. Adding a document requires a new format version.
// Portable metadata only; consumers hash exact UTF-8 bytes themselves.
import { z } from 'zod';
import { Day, IsoDateTime } from './primitives.ts';

export const OVERVIEW_DOCUMENT = 'supply/usdc/overview.json';
export const PublicationVersion = z.uuid().regex(/^[0-9a-f-]+$/);
export type PublicationVersion = z.infer<typeof PublicationVersion>;
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);

export const PublicationCurrent = z.strictObject({
  formatVersion: z.literal(1),
  version: PublicationVersion,
  manifestSha256: Sha256,
  publishedAt: IsoDateTime,
  previous: PublicationVersion.nullable(),
}).superRefine((value, ctx) => {
  if (value.previous === value.version) ctx.addIssue({ code: 'custom', path: ['previous'], message: 'Previous version must differ' });
});
export type PublicationCurrent = z.infer<typeof PublicationCurrent>;

export const PublicationManifest = z.strictObject({
  formatVersion: z.literal(1),
  version: PublicationVersion,
  builtAt: IsoDateTime,
  stateSha256: Sha256,
  documents: z.tuple([z.strictObject({
    key: z.string(),
    byteLength: z.int().positive().max(Number.MAX_SAFE_INTEGER),
    sha256: Sha256,
    asOf: Day.nullable(),
    generatedAt: IsoDateTime,
  })]),
}).superRefine((value, ctx) => {
  const document = value.documents[0];
  if (document.key !== `versions/${value.version}/${OVERVIEW_DOCUMENT}`) {
    ctx.addIssue({ code: 'custom', path: ['documents', 0, 'key'], message: 'Document key must match publication version and route' });
  }
  if (document.generatedAt !== value.builtAt) {
    ctx.addIssue({ code: 'custom', path: ['documents', 0, 'generatedAt'], message: 'Document clock must match build clock' });
  }
});
export type PublicationManifest = z.infer<typeof PublicationManifest>;
