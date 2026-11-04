AI review: on · reviewer commandcode · model deepseek/deepseek-v4.1-flash · effort high · rounds 3

# Tokens for the mobile app screens

**Why.** The owner accepted the `Mobile-*` boards on 2026-11-04 (the app: a daily brief and a ledger, three tabs). `packages/tokens/src/tokens.ts` is the single source of design values for web CSS and React Native, so the sizes the boards fix land there first; then the designer rebuilds the Design System and the mobile track codes the screens.

**Launch criteria.** None: mobile goes to users after the web launch. The six chain colours and every existing token stay unchanged (proof: the diff touches no existing name or value; `pnpm test` passes).

- **Design**: /Users/dmitry/dev/block-and-tell-artifacts/handoff/mobile/design/mobile-2026-11-04

The tokens are listed in that folder's `README.md`.

## Task

Add to `tokens` in `packages/tokens/src/tokens.ts`, in one commented group "native app", keeping every existing name and value:

| Token | Value |
|---|---|
| `tab-bar-height` | `56px` |
| `touch-target` | `44px` |
| `tab-indicator` | `2px` |
| `row-height-chain` | `84px` |
| `row-height-ledger` | `64px` |
| `row-height-operation` | `64px` |
| `skeleton-pulse` | `1600ms` |
| `radius-sheet` | `16px` |

They go into the shared `tokens` object (not `phoneTokens`, which overrides web tokens at phone width). Regenerate `apps/web/src/styles/tokens.css` with `pnpm --filter @app/tokens generate`. If the mobile theme converter (`apps/mobile/src/theme/`) needs these values typed (numbers for px, ms), extend it and its test; if it maps them generically, change nothing there. One line in `docs/design.md`, Tokens: the native-app group and what it is for.

Out of scope: any web page or component, any screen of the app, any other token.

- **Files you may change**: `packages/tokens/**`, `apps/web/src/styles/tokens.css`, `apps/mobile/src/theme/**`, `docs/design.md`.

- **Plan**: plan if you need one.

## Setup and checks

Fresh `origin/main` of this repository (`zakharov-dy/stable-story-ui`), `pnpm install`. Branch `tokens/mobile-screens`. Checks with `set -o pipefail` and cut output: `pnpm typecheck | tail -40`, `pnpm lint | tail -40`, `pnpm test --reporter=dot | tail -40`, `pnpm test:rn | tail -30`, then with `AI_AGENT` and `CLAUDECODE` unset `pnpm check:build | tail -40` and `pnpm browser-smoke | tail -30` (in an OpenCode sandbox `CI=true` may be needed). PR at the first push; the final report has every exit code and the sha of the last code commit. Author: the configured git identity (`git log -1 --format='%an <%ae>'` before each push); `Co-Authored-By` of the model that wrote the code. Network only for git and pnpm. Ask (`QUESTION:`) only for scope or the owner's decisions.

## Для ревьюера

Major: an existing token name or value changed; generated CSS out of sync with `tokens.ts`; a native value converted wrongly (unit dropped or mis-scaled); a test that passes for the wrong reason. Everything else is minor.