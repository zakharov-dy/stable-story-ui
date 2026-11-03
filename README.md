# Stable Story UI

*Working name; it may change.*

The public site and the mobile app of Stable Story, with the API contracts, design tokens and shared
view logic they use. The UI is a self-contained workspace: it imports nothing outside this directory,
installs from its own lockfile and runs all of its checks from here.

## Layout

| Path | What it is |
|---|---|
| `apps/web` | The public page: Next.js dynamic SSR, seven views, How we count, disclaimer. Reads the API through `ApiClient` only. |
| `apps/mobile` | Expo SDK 58 / React Native development-client skeleton. |
| `packages/contracts` | API zod schemas, DTOs, `ApiClient` (http and mock), API fixtures; publication pointer and manifest schemas. |
| `packages/tokens` | Typed design constants for web and React Native; source of the committed generated web `tokens.css`. |
| `packages/view` | Pure view logic over API responses: formatting, quality, day equation, periods, series, chart scales and tooltip values. |
| `docs` | The design language (`docs/design.md`), the testing workflow (`docs/web-testing.md`) and the UI decisions (`docs/decisions/`). |

## Commands

```bash
pnpm install
pnpm typecheck      # the workspace root and every UI package
pnpm lint           # ESLint, including the UI module boundaries
pnpm test           # Vitest project "unit": **/*.test.ts
pnpm check:build    # web: next build without the API, plain-HTTP pages per mock state
pnpm browser-smoke  # web: headless Chrome over every mock state, reusing that build
pnpm test:rn        # mobile: jest-expo native component tests
```

`browser-smoke` runs the technical checks in headless Chrome; in a sandbox that cannot start Chrome
it exits with a clear message before it launches the browser (`BROWSER_SMOKE_UNSUPPORTED_SANDBOX`),
and that is not a pass.

## Rules

- The UI knows only `contracts`, `tokens` and `view`; it reaches data through `ApiClient` and builds
  no metrics. `contracts` imports no server package; `tokens` imports no workspace package; `view`
  imports only types from `contracts` and uses ES APIs and `Intl` only.
- The web and mobile apps share contracts, tokens and view logic, never components or UI texts.
- A contract change updates the schemas, fixtures and consumers together.
- Code, comments and docs are in English. The product name is a working name; web product code takes
  it only from `apps/web/src/texts.ts`, mobile from its resolved Expo config.
