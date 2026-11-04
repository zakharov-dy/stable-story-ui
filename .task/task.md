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

AI review, plan round 1/3 (commandcode deepseek/deepseek-v4.1-flash · high, commit a0bdbe5): plan approved.
The plan is implementable and grounded in the repository: it reuses the existing WCAG plus CIE76/Machado palette method, correctly finds all four proposed colours below the ΔE 20 bar, and plans additive tokens, regenerated CSS, docs, mobile exposure and the full check sequence. The main open risk is finding four mutually separated replacements; the plan's investigate-then-escalate fallback is appropriate.

Questions from the reviewer:
- Where will the palette test live? Confirm packages/tokens/tools/ rather than packages/tokens/src/, because the src tsconfig has types: [] and include: ["src"], and confirm the test pins the final four values, the six original chain values, and rounded contrast/minimum-distance expectations.
- If the mutual-separation search finds no four-colour set, what exact fallback will you present to the coordinator (which constraint is relaxed, with numbers), and will you still deliver four chain tokens?
- Will the final report name each replaced chain colour with its old and new values and its computed contrast and minimum distances, as the task requires?

Minor (optional, non-blocking):
- Align the distance bar with the existing test, which rounds deltaE to one decimal before asserting >=20, or document why the planned unrounded >=20 bar is intentionally stricter.
- List the exact reference set in the plan and test: six chains, five flows, positive/negative plus delayed/unreconciled/unpaired/incomplete, and the other new chain colours; note that color-shade-incomplete shares incomplete's hue.
- Keep the mobile change to the minimum the task requires: theme.chains currently mirrors the six registry chains, so justify extending it to ten and adding an opacity field, or leave the generic maps untouched and change nothing there.
- Confirm the first push opens the PR as the task requires, and keep all docs/design.md edits inside the Tokens section without touching the six-slot page rules or any Launch rule.

Implement the plan now. Record decisions and any deviation from the plan, with the reason, in .task/decisions.md. Push when the implementation is ready for review: the same reviewer session reviews it, with a new limit of 3 rounds.

Clarification (2026-11-04): approved. For chain slots 7–10 use your fallback quartet (`#229165`, `#a6814a`, `#827b8a`, `#9e83fa`): contrast ≥ 4.5 on bg and surface and normal-vision ΔE ≥ 20 stay as required; the floor under the three simulated visions for comparisons involving slots 7–10 is 14.2 ΔE. Slots 7–10 are reserved for chains not enabled yet; say in `docs/design.md`, in one sentence, that they are re-checked when a seventh chain is enabled. Keep the palette check as a unit test with these floors. Complete the task as planned.
