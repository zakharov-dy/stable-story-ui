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
  timeout signal (`TimeoutError`/`ETIMEDOUT`/`RequestTimeout` codes, 408/504 statuses,
  `ApiError.timeout`), else "other". `openStore()`
  throwing means the store could not be built → configuration error.
- Kind stays `transport` for every storage failure; `status` stays `null` per the contracts
  convention (null for transport); the R2 HTTP status lives in the message text only. Page
  states unchanged (`unavailable` / what each is today). The whole-call deadline
  (`Publication read timed out`, `timeout: true`) is untouched.
- Store-level timeouts keep `timeout: false`: the flag means the client's own deadline fired.

## Round 1 review (F1, major) — fixed
- Finding: `errorName` read `name` before `code`/`Code`, so every `Error` returned the inherited
  generic `'Error'` and code-only signals (`ETIMEDOUT`, `Code: 'AccessDenied'`/`'NoSuchKey'`)
  fell through to "other storage error". Valid: the decision note promised code classification
  the implementation could not reach.
- Fix: `errorName` now reads `code`, `Code`, then `name`, and treats the generic `'Error'` as
  absent. Regression tests use `Object.assign(new Error(...), { code | Code })` with no `name`
  override; the timeout `it.each` covers name, code, S3 `RequestTimeout` code, 408 and 504.
- Added (reviewer's optional nudge, accepted): S3 `RequestTimeout` code and HTTP 408/504 statuses
  classify as timeout — a 408/504 is the server saying the request timed out, so the timeout
  class is the honest one. Plain message text (e.g. "socket timeout" in an `Error` message) still
  does not classify: message text is the leak vector and must not steer the class.

## Round 1 review (minors)
- Fixed: `api.test.ts` boundary comment said the client default was "the same 10 000 ms" as the
  page constant; now says the client default stays 10 000 ms while the page constant is 30 s.
- Dropped with reason: `NoSuchBucket` stays in the not-found class. It arrives as a 404 read
  failure for the key being read, and the bucket name itself must never appear in a log line, so
  there is no honest configuration message that could name it. A wrong-bucket deployment still
  surfaces as `unavailable` with a 404 keyed line pointing at the failing read.
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
