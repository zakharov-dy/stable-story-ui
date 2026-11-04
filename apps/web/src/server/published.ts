import 'server-only';
import { createHash } from 'node:crypto';
import { ApiError, PublicationCurrent, PublicationManifest, endpoints, type ApiClient, type Overview } from '@app/contracts';

export interface PublishedStore {
  get(key: string, signal: AbortSignal): Promise<Uint8Array | null>;
  close?(): void;
}

// One deadline includes all three requests and body consumption, below the page's 30 seconds.
export const PUBLICATION_TIMEOUT_MS = 6_000;
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const invalid = (reason: string): ApiError => new ApiError('invalid_response', `Publication ${reason}`);
const notPublished = (): Promise<never> => Promise.reject(new ApiError('http', 'Request is not published', { status: 404, code: 'not_published' }));

// R2 read failures are told apart in the logged ApiError message so the runtime log names the
// class — configuration, access, a missing object, a timeout or another storage error — with the
// HTTP status and the object key where known. Only those facts are ever embedded: the original
// error, its message and its cause can carry the endpoint, bucket host, account id, credentials
// or a signed URL, so they are never retained or interpolated.
const ACCESS_DENIED_NAMES = new Set(['AccessDenied', 'Forbidden', 'InvalidAccessKeyId', 'SignatureDoesNotMatch']);
const NOT_FOUND_NAMES = new Set(['NoSuchKey', 'NoSuchBucket', 'NotFound']);
const TIMEOUT_NAMES = new Set(['TimeoutError', 'ETIMEDOUT']);

const errorField = (error: unknown, field: string): unknown => {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as Record<string, unknown>)[field];
};

const errorName = (error: unknown): string | null => {
  for (const field of ['name', 'code', 'Code'] as const) {
    const candidate = errorField(error, field);
    if (typeof candidate === 'string' && candidate !== '') return candidate;
  }
  return null;
};

// A numeric HTTP status from the SDK metadata or a status-like field; anything else is unknown.
const errorStatus = (error: unknown): number | null => {
  const metadata = errorField(error, '$metadata');
  const candidates = [
    typeof metadata === 'object' && metadata !== null ? (metadata as Record<string, unknown>).httpStatusCode : undefined,
    errorField(error, 'statusCode'),
    errorField(error, 'status'),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 100 && candidate <= 599) return candidate;
  }
  return null;
};

const errorTimedOut = (error: unknown): boolean => {
  if (error instanceof ApiError) return error.timeout;
  const name = errorName(error);
  return name !== null && TIMEOUT_NAMES.has(name);
};

/** Classifies a `PublishedStore.get` rejection for one object key without leaking its details. */
const storageError = (key: string, error: unknown): ApiError => {
  const status = errorStatus(error);
  const name = errorName(error);
  const at = (message: string): ApiError =>
    new ApiError('transport', status === null ? `${message} for "${key}"` : `${message} for "${key}" (status ${status})`);
  if (status === 401 || status === 403 || (name !== null && ACCESS_DENIED_NAMES.has(name))) {
    return at('Publication storage access denied');
  }
  if (status === 404 || (name !== null && NOT_FOUND_NAMES.has(name))) return at('Publication object not found');
  if (errorTimedOut(error)) return new ApiError('transport', `Publication storage read timed out for "${key}"`);
  return at('Publication storage read failed');
};

function json(bytes: Uint8Array, label: string): unknown {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; }
  catch { throw invalid(`${label} is not JSON`); }
}

/** No shared cache: a call owns its pointer, verified bytes and transport until completion. */
export function createPublishedClient(openStore: () => PublishedStore): ApiClient {
  return {
    async overview(params, options): Promise<Overview> {
      if (params?.asset !== undefined && params.asset !== 'usdc') return notPublished();
      const controller = new AbortController();
      let timedOut = false;
      const abort = () => controller.abort(); // caller reasons can contain credentials; never retain them
      if (options?.signal?.aborted) abort();
      else options?.signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, PUBLICATION_TIMEOUT_MS);
      let store: PublishedStore | undefined;
      const cancelled = () => new ApiError('transport', timedOut ? 'Publication read timed out' : 'Publication read aborted', { timeout: timedOut });
      let onAbort: (() => void) | undefined;
      try {
        if (controller.signal.aborted) throw cancelled();
        const interruption = new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(cancelled());
          controller.signal.addEventListener('abort', onAbort, { once: true });
        });
        try { store = openStore(); } catch { throw new ApiError('transport', 'Publication storage configuration error'); }
        const opened = store;
        const read = async (key: string, label: string): Promise<Uint8Array> => {
          if (controller.signal.aborted) throw cancelled();
          let bytes: Uint8Array | null;
          try { bytes = await opened.get(key, controller.signal); }
          catch (error) { throw storageError(key, error); }
          if (bytes === null) throw invalid(`${label} is missing`);
          return bytes;
        };
        const publication = async (): Promise<Overview> => {
          const current = PublicationCurrent.safeParse(json(await read('current.json', 'pointer'), 'pointer'));
          if (!current.success) throw invalid('pointer schema is invalid');
          const pinned = current.data;
          const manifestBytes = await read(`versions/${pinned.version}/manifest.json`, 'manifest');
          if (hash(manifestBytes) !== pinned.manifestSha256) throw invalid('manifest hash mismatch');
          const manifest = PublicationManifest.safeParse(json(manifestBytes, 'manifest'));
          if (!manifest.success) throw invalid('manifest schema is invalid');
          if (manifest.data.version !== pinned.version) throw invalid('manifest version mismatch');
          const document = manifest.data.documents[0];
          const bytes = await read(document.key, 'overview');
          if (bytes.byteLength !== document.byteLength) throw invalid('overview byte length mismatch');
          if (hash(bytes) !== document.sha256) throw invalid('overview hash mismatch');
          const overview = endpoints.overview.response.safeParse(json(bytes, 'overview'));
          if (!overview.success) throw invalid('overview schema is invalid');
          if (overview.data.asOf !== document.asOf || overview.data.generatedAt !== document.generatedAt) throw invalid('overview metadata mismatch');
          return overview.data;
        };
        return await Promise.race([publication(), interruption]);
      } catch (error) {
        if (controller.signal.aborted) throw cancelled();
        if (error instanceof ApiError) throw error;
        throw new ApiError('transport', 'Publication storage read failed');
      } finally {
        clearTimeout(timer);
        options?.signal?.removeEventListener('abort', abort);
        if (onAbort) controller.signal.removeEventListener('abort', onAbort);
        // A cleanup diagnostic from a transport must not expose signed requests either.
        try { store?.close?.(); } catch { /* no unsafe transport diagnostics */ }
      }
    },
    series: notPublished,
    events: notPublished,
    eventsStats: notPublished,
  };
}
