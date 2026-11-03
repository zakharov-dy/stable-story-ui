import 'server-only';
import { GetObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import type { R2Config } from './config.ts';
import type { PublishedStore } from './published.ts';

/** GET only. Node HTTP transport bypasses Next caches; no SDK logger or credential discovery. */
export function createR2Store(config: R2Config, requestHandler?: S3ClientConfig['requestHandler']): PublishedStore {
  const client = new S3Client({
    region: 'auto', endpoint: config.endpoint, forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    maxAttempts: 1,
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: requestHandler ?? { connectionTimeout: 1_000, requestTimeout: 2_000 },
  });
  return {
    async get(key, signal) {
      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }), { abortSignal: signal });
      if (result.Body === undefined || !result.ETag) throw new Error('Publication object unreadable');
      return result.Body.transformToByteArray();
    },
    close: () => client.destroy(),
  };
}
