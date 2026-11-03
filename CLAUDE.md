# CLAUDE.md — the UI workspace

Guidance for agents working in `ui/`. The UI is a self-contained workspace: it has its own
`pnpm-workspace.yaml`, lockfile, tsconfig, ESLint, Vitest and CI, and it imports and references
nothing outside this directory. The backend lives elsewhere and is not a dependency of the UI.

## Stack

- pnpm 11 workspaces, no Turborepo. Node ≥ 22.18 (`.nvmrc`), ESM everywhere.
- TypeScript 6, `strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`: no `enum`, `namespace` or
  parameter properties; relative imports carry the `.ts` extension; types use `import type`. No build
  step: packages export their TypeScript sources (`exports` → `./src/*.ts`), Node runs `.ts` directly.
- ESLint 10 + typescript-eslint (type-checked), Vitest 5.
- Web: Next.js 16 App Router with dynamic SSR, React 19.
- Mobile: Expo SDK 58, React Native 0.88.1, Expo Router and development builds; never Expo Go.

## Commands

```bash
pnpm install
pnpm typecheck        # tsc -p tsconfig.json && pnpm -r typecheck
pnpm lint             # eslint .
pnpm test             # Vitest project "unit": **/*.test.ts
pnpm check:build      # web: next build without the API, plain-HTTP pages per mock state
pnpm browser-smoke    # web: headless Chrome over every mock state, reusing that build
pnpm test:rn          # mobile: jest-expo, **/*.test.tsx
pnpm --filter @app/tokens generate   # regenerate apps/web/src/styles/tokens.css from tokens.ts
pnpm --filter @app/mobile ios --device 'iPhone 17 Pro'  # iOS development client (Xcode/CocoaPods)
pnpm --filter @app/mobile start --ios  # Metro for an installed development client
pnpm --filter @app/mobile storybook --ios  # development-only component catalog
```

`pnpm browser-smoke` runs the technical checks in headless Chrome. It refuses to start when
`BROWSER_SMOKE_UNSUPPORTED_SANDBOX` is set, because Chrome cannot start in that sandbox; the refusal
is not a pass. `CI=true` lets Playwright add `--no-sandbox` where the CI container needs it.
Next 16 refuses a production build from a shell it detects as an agent environment
(`SecurityFatalError`); the CI runner and a plain terminal are not affected.

## Modules and boundaries

| Path | Package | May import (workspace) |
|---|---|---|
| `packages/contracts` | `@app/contracts` | — |
| `packages/tokens` | `@app/tokens` | — |
| `packages/view` | `@app/view` | `contracts` |
| `apps/web` | — | `contracts`, `tokens`, `view` |
| `apps/mobile` | — | `contracts`, `tokens`, `view` |

The rules are enforced by pnpm (undeclared dependencies do not resolve), package `exports` (no deep
imports) and `boundaries/module-boundaries` in `eslint.boundaries.js` (with tests). A relative import
must stay inside the module, and the UI imports nothing outside itself.

- `contracts` production code imports no server package. It runs in web and React Native, so it has
  no `@types/node` and compiles with `lib: DOM`.
- `tokens` production code imports no workspace package and uses no Node or DOM APIs or
  `@types/node`; it compiles with ES libraries only. Its typed constants are the source of the
  committed generated web `tokens.css` (ADR 0025).
- `view` production code imports only types from `contracts` and uses ES APIs and `Intl` only: no
  React, components, Node/DOM APIs, UI texts or product name (ADR 0027). Clients supply typed labels.
  Its compiler includes DOM declarations for the transitive contracts sources, with `types: []`;
  ESLint guards platform imports/globals in view itself. It never aggregates data or builds buckets.
- `web` and `mobile` know only `contracts`, `tokens` and `view` and access data only through
  `ApiClient` (local HTTP/mock today; prepared documents in production). They share no components;
  each client owns its UI texts.

## Contracts and ownership

- `packages/contracts` — the API zod schemas, DTOs, `ApiClient` and API fixtures. A change to a
  schema, the fixtures or their consumers is one change; it keeps the negative cases asserting the
  exact zod issue path.
- `packages/tokens` — the typed token source. A token change edits `src/tokens.ts` and regenerates
  `apps/web/src/styles/tokens.css`; the drift test fails otherwise.
- `packages/view` — pure logic only; the clients own labels and rendering.

## Conventions

- Code, comments and docs are in English.
- The product name is a working name that may change. Web product code takes it only from
  `apps/web/src/texts.ts`; mobile keeps one matching working-name constant in
  `apps/mobile/app.config.ts`, with a source comment, and screens read the resolved Expo config name.
  Package names stay neutral (`@app/*`).
- Unit tests sit next to the code as `*.test.ts`; native component tests are `*.test.tsx` and run
  with jest-expo; the two discoveries are disjoint.
- Tests check meaning (numbers, sign, `null` versus zero, chain, date, quality, scale), not
  attribute order, literal SVG text or CSS rule order.
- `packages/contracts/fixtures` and `packages/contracts/src/mock-index.generated.ts` are generated
  data; commit them with the code that reads them.
