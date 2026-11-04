# Decisions — server diagnostics

## Findings
- `PAGE_REQUEST_TIMEOUT_MS` (10 s) was documented as "shorter than the API's 15 s
  `statement_timeout`", but the cold `GET /v1/supply/overview` takes ~9.9 s of whole-request
  compute, so the page gave up right when the API was about to answer. Fixed at the client
  value only; the contracts HTTP default (10 s) is untouched.
- All R2 read failures surfaced as one `transport` message with no class, and the original
  error/message/cause can carry endpoint, bucket host, credentials or signed URLs, so the new
  messages embed only the class, a numeric HTTP status and the object key.

## Resolutions
- `PAGE_REQUEST_TIMEOUT_MS = 30_000`; comment says whole overview request, ~10 s cold.
  Timer tests still drive off the constant; added an explicit `toBe(30_000)` pin.
- `published.ts` classifies `get()` rejections by numeric status first (`$metadata.httpStatusCode`,
  `statusCode`, `status`), then by canonical S3 codes (`AccessDenied`, `InvalidAccessKeyId`,
  `SignatureDoesNotMatch`, `Forbidden` / `NoSuchKey`, `NoSuchBucket`, `NotFound`), then by
  timeout signal (`TimeoutError`, `ETIMEDOUT`, `ApiError.timeout`), else "other". `openStore()`
  throwing means the store could not be built → configuration error.
- Kind stays `transport` for every storage failure; `status` stays `null` per the contracts
  convention (null for transport); the R2 HTTP status lives in the message text only. Page
  states unchanged (`unavailable` / what each is today). The whole-call deadline
  (`Publication read timed out`, `timeout: true`) is untouched.
- Store-level timeouts keep `timeout: false`: the flag means the client's own deadline fired.

## Deviations
- None from the task. Also refreshed the stale `published.ts` deadline comment ("page's 10
  seconds" → 30) since the page timeout it references changed.

## Rejected alternatives
- Message-text matching for classification (e.g. /timeout/i, /AccessDenied/): the text is the
  leak vector; a secret-containing message must never steer the class. Structured fields only.
- Putting the R2 status into `ApiError.status`: contracts say `status` is null for transport,
  and `loadPage` would print it as a second status; message-only keeps one convention.
- `NoSuchBucket` as configuration: it arrives as a 404 read failure for the key being read,
  so it stays in the not-found class keyed by that read.
- Retrying or touching R2 store / API / contract: out of scope, untouched.
