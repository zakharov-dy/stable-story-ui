import { ApiError } from '@app/contracts';

interface LogFields {
  ms?: number;
  status?: number | null;
  kind?: ApiError['kind'];
  code?: string | null;
  scenario?: string;
}
const safeCodes = new Set(['unknown_asset', 'unknown_chain', 'no_coverage', 'invalid_query', 'invalid_cursor', 'db_unavailable', 'internal', 'mock_query_unsupported']);

export function log(event: 'api.request' | 'scenario.selected', fields: LogFields): void {
  if (!__DEV__) return;
  const entry = event === 'api.request'
    ? { evt: event, path: '/v1/supply/overview', ms: fields.ms, status: fields.status,
      ...(fields.kind ? { kind: fields.kind, code: fields.code === null ? null : safeCodes.has(fields.code ?? '') ? fields.code : 'unknown' } : {}) }
    : { evt: event, scenario: fields.scenario };
  console.info(JSON.stringify(entry));
}

export function logFailure(error: unknown, ms: number): void {
  if (error instanceof ApiError) log('api.request', { ms, kind: error.kind, status: error.status, code: error.code });
}
