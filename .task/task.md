AI review: on · reviewer commandcode · model deepseek/deepseek-v4.1-flash · effort high · rounds 3

# Tokens for the Home redesign

**Why.** Stable Story is live (https://stable-story.vercel.app). The owner accepted a new home page (boards `Home-*`, 2026-11-04): five blocks instead of ten, room for up to 10 chains and a second stablecoin. The page code comes in the next PR; the tokens it needs land first, because `packages/tokens/src/tokens.ts` is the single source for web CSS and React Native.

**Launch criteria.** LC-02 (six chains, each its own colour): the six existing chain colours are unchanged; proof — `tokens.ts` diff touches no existing value, and `pnpm test` passes.

- **Design**: /Users/dmitry/dev/block-and-tell-artifacts/handoff/web/design/home-2026-11-04

The tokens are listed in that folder's `README.md`, section "Tokens to add to `tokens.ts` first".

## Task

Add to `packages/tokens/src/tokens.ts`, keeping every existing name and value:

| Token | Value |
|---|---|
| `color-chain-7` … `color-chain-10` | `#4fb39a`, `#b08a5e`, `#8fb5c9`, `#c7a6e6` |
| `sticky-bar-height` | `48px` |
| `opacity-dimmed` | `0.25` |
| `section-gap` | `96px` |

The four chain colours are proposed by the designer: check that each is distinguishable from the six existing chain colours, the five flow colours and the quality colours on `--color-bg` and `--color-surface` (contrast and mutual distance, by the method the repository already uses for the palette if there is one; otherwise a small unit test with the computed numbers). If one fails, pick the nearest value that passes and name it in the report.

Regenerate `apps/web/src/styles/tokens.css` with `pnpm --filter @app/tokens generate`. Update `docs/design.md` (Tokens: the new tokens and what they are for; one line that chain slots are 10). If the mobile theme converter (`apps/mobile/src/theme/`) enumerates tokens explicitly, extend it; if it maps them generically, change nothing there.

Out of scope: any page or component change, any other token change, the `Launch-*` rules in `docs/design.md` (the next PR rewrites them).

- **Files you may change**: `packages/tokens/**`, `apps/web/src/styles/tokens.css`, `docs/design.md`, `apps/mobile/src/theme/**` (only if needed as above).

- **Plan**: plan if you need one.

## Setup and checks

Fresh `origin/main` of this repository (`zakharov-dy/stable-story-ui`), `pnpm install`. Branch `tokens/home-redesign`. Checks with `set -o pipefail` and cut output: `pnpm typecheck | tail -40`, `pnpm lint | tail -40`, `pnpm test --reporter=dot | tail -40`, then (with `AI_AGENT` and `CLAUDECODE` unset) `pnpm check:build | tail -40` and `pnpm browser-smoke | tail -30`; `pnpm test:rn | tail -30` if you touched `apps/mobile`. PR at the first push; the final report has every exit code and the sha of the last code commit. Author: the configured git identity (`git log -1 --format='%an <%ae>'` before each push); `Co-Authored-By` of the model that wrote the code. Network only for git and pnpm. Ask (`QUESTION:`) only for scope or the owner's decisions.

## Для ревьюера

Major: an existing token name or value changed; a new chain colour indistinguishable from an existing data colour (show the numbers); generated CSS out of sync with `tokens.ts`; a test that passes for the wrong reason. Everything else is minor.