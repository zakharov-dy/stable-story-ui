import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { publication } from '../src/test-support/publication.ts';

/** Loopback-only path-style S3 GET fake; signatures are deliberately ignored. */
export async function withFakeR2<T>(use: (fake: {
  env: Record<string, string>;
  sentinels: string[];
  requests: string[];
  overview: Awaited<ReturnType<typeof publication>>['overview'];
  expectedKeys: string[];
}) => Promise<T>): Promise<T> {
  const fixture = await publication();
  const bucket = `leak-bucket-${randomUUID()}`;
  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    requests.push(`${request.method ?? ''} ${request.url?.split('?')[0] ?? ''}`);
    const prefix = `/${bucket}/`;
    const key = request.url?.startsWith(prefix) ? request.url.split('?')[0]?.slice(prefix.length) : undefined;
    const bytes = key === undefined ? undefined : fixture.objects.get(key);
    if (request.method !== 'GET' || bytes === undefined) {
      response.writeHead(404, { 'content-type': 'application/xml' }).end('<Error><Code>NoSuchKey</Code></Error>');
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json', etag: '"fake-r2"', 'cache-control': 'no-store', 'content-length': bytes.byteLength });
    response.end(bytes);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Fake R2 did not bind loopback');
    const env = {
      API_MODE: 'published', R2_ENDPOINT: `http://127.0.0.1:${address.port}`, R2_BUCKET: bucket,
      R2_ACCESS_KEY_ID: `sentinel-access-${randomUUID()}`, R2_SECRET_ACCESS_KEY: `sentinel-secret-${randomUUID()}`,
    };
    return await use({ env, sentinels: [env.R2_ENDPOINT, bucket, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY], requests, overview: fixture.overview,
      expectedKeys: ['current.json', fixture.manifestKey, fixture.documentKey].map((key) => `GET /${bucket}/${key}`),
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
