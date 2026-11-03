import type { ApiClient } from '@app/contracts';
import type { DataConfig } from '../config.ts';

export function createDevelopmentClient(_config: DataConfig): ApiClient {
  throw new Error('Development client is unavailable in release');
}
export function DevelopmentControls(_props: { config: DataConfig; replaceClient: (client: ApiClient) => void }) {
  return null;
}
