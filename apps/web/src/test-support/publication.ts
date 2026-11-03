// Shared synthetic publication for the offline unit tests and loopback-only web gates.
import { createHash } from 'node:crypto';
import { createMockClient, OVERVIEW_DOCUMENT, PublicationCurrent, PublicationManifest, type MockState, type Overview } from '@app/contracts';

export const VERSION_A = '11111111-1111-4111-8111-111111111111';
export const VERSION_B = '22222222-2222-4222-8222-222222222222';
export const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

export async function publication(state: MockState = 'ok', version = VERSION_A) {
  const overview: Overview = await createMockClient(state).overview();
  const bytes = jsonBytes(overview);
  const manifest = PublicationManifest.parse({
    formatVersion: 1, version, builtAt: overview.generatedAt, stateSha256: '0'.repeat(64),
    documents: [{ key: `versions/${version}/${OVERVIEW_DOCUMENT}`, byteLength: bytes.byteLength, sha256: sha256(bytes), asOf: overview.asOf, generatedAt: overview.generatedAt }],
  });
  const manifestKey = `versions/${version}/manifest.json`;
  const current = PublicationCurrent.parse({ formatVersion: 1, version, manifestSha256: sha256(jsonBytes(manifest)), publishedAt: overview.generatedAt, previous: null });
  const objects = new Map<string, Uint8Array>([['current.json', jsonBytes(current)], [manifestKey, jsonBytes(manifest)], [manifest.documents[0].key, bytes]]);
  return {
    overview, manifest, current, objects, manifestKey, documentKey: manifest.documents[0].key,
    // Allows each negative test to isolate a downstream check while keeping outer hashes valid.
    updateManifest() {
      objects.set(manifestKey, jsonBytes(manifest));
      current.manifestSha256 = sha256(jsonBytes(manifest));
      objects.set('current.json', jsonBytes(current));
    },
    updateDocument(value: unknown) {
      const changed = jsonBytes(value);
      objects.set(manifest.documents[0].key, changed);
      manifest.documents[0].byteLength = changed.byteLength;
      manifest.documents[0].sha256 = sha256(changed);
      this.updateManifest();
    },
  };
}
