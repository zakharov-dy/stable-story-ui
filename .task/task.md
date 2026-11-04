AI review: on · reviewer commandcode · model deepseek/deepseek-v4.1-flash · effort high · rounds 3

# Overview timeout for the live API and the R2 failure type in the runtime log

**Why.** Stable Story is live and reads prepared documents from R2; the owner's local page (live mode against the local API) is where the owner looks at fresh data. Two small server-side fixes, nothing visible changes:

1. The backend measured a cold `GET /v1/supply/overview?asset=usdc` through the local API at 9.9 s (0.07 s warm). The page's client gives up at 10 s (`PAGE_REQUEST_TIMEOUT_MS` in `apps/web/src/server/api.ts`), so after an idle period the owner's page shows "data unavailable". Production is not affected (it reads R2).
2. In production every R2 read failure is logged as the same "Publication storage read failed" (`apps/web/src/server/published.ts`), so the Vercel runtime log does not say whether the cause is configuration, access, a missing object or a timeout. The owner asked for the type, without secrets.

**Launch criteria.** LC-01 and LC-05 stay met: the published page still renders `data-page-state="data"` (proof: `browser-smoke`, including the fake-R2 states); LC-09: no credential, bucket URL or signed URL in any log line or page (proof: a unit test on the log text).

- **Design**: none

## Task

1. Live mode: raise the overview request timeout of the HTTP client to 30 s. Keep the constant and its comment honest: it is the whole overview request, not one SQL statement; say that the cold computation was measured at about 10 s. Update the existing timer test.
2. Published mode: tell R2 read failures apart in the `ApiError` message that `loadPage` logs: missing or invalid configuration, access denied (401/403), object not found (404), timeout, and any other storage error. Messages name the class and, where known, the HTTP status and the object key (`current.json`, a version manifest or document key) — never an endpoint, bucket host, account id, access key, secret, token or signed URL. The page states do not change: every class is still `unavailable` (or what it is today). A unit test per class asserts the message and that no configured secret value appears in it.

Out of scope: the contract (`packages/contracts`), the page, R2 store retries, the API.

- **Files you may change**: `apps/web/src/server/**`.

- **Plan**: plan if you need one.

## Setup and checks

Fresh `origin/main` of this repository (`zakharov-dy/stable-story-ui`), `pnpm install`. Branch `web/server-diagnostics`. Checks with `set -o pipefail` and cut output: `pnpm typecheck | tail -40`, `pnpm lint | tail -40`, `pnpm test --reporter=dot | tail -40`, then with `AI_AGENT` and `CLAUDECODE` unset `pnpm check:build | tail -40` and `pnpm browser-smoke | tail -30` (in an OpenCode sandbox `CI=true` may be needed). PR at the first push; the final report has every exit code and the sha of the last code commit. Author: the configured git identity (`git log -1 --format='%an <%ae>'` before each push); `Co-Authored-By` of the model that wrote the code. Network only for git and pnpm; no live R2 or API calls in tests. Ask (`QUESTION:`) only for scope or the owner's decisions.

## Для ревьюера

Major: a secret, endpoint, bucket host or signed URL can reach a log line; a page state changes; a failure class is misclassified for an input the code allows; a test that passes for the wrong reason; live network in tests. Everything else is minor.