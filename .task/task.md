AI review: on · reviewer commandcode · model deepseek/deepseek-v4.1-flash · effort high · rounds 2

# Site favicon and apple touch icon from the accepted design export

## Why

Stable Story is the owner's public showcase: the page is live and will be linked from a CV, so the identity in the browser chrome must read well (web track goal, `projectbrief.md`). Today `apps/web/src/app/icon.svg` is a transparent mark that reads poorly on a light tab strip. The owner accepted the designer's icon export (request 2026-11-04, mark A = the current product mark), and this task puts its site icons into the web app.

## Launch criteria

None (inbox entry: «Критерий: нет»). No row of `docs/requirements/launch-criteria.md` changes in this PR.

## What to read

- `apps/web/src/app/` — the Next.js App Router file conventions already in use (`icon.svg`, `apple-icon.png`).
- The inlined export literals below. The export folder `/Users/dmitry/dev/block-and-tell-artifacts/handoff/mobile/design/icon-2026-11-04/` is outside this worktree; the literals below are the exact file contents you need.

Design export excerpt (README): the product mark is the one already in the code (`Mark.tsx`, two overlapping squares, `#b69aff`); app and site icons put it on a `#13112a` tile; sizes ≤ 32 px use a heavier outline (2.2 instead of 1.5 of 20 units) so it reads at 16 px; `favicon.svg` is the site favicon and replaces the transparent `apps/web/src/app/icon.svg`; `apple-touch-icon-180.svg` is the site apple touch icon; PNGs are not included — the worker renders them from these SVGs at the sizes the web needs.

`favicon.svg` (exact content, 32×32):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#13112a"></rect><rect x="8.33" y="8.33" width="9.69" height="9.69" rx="1.88" fill="none" stroke="#b69aff" stroke-width="2.07"></rect><rect x="14.12" y="14.12" width="9.88" height="9.88" rx="1.88" fill="#b69aff"></rect></svg>
```

`apple-touch-icon-180.svg` (exact content, 180×180):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" rx="0" fill="#13112a"></rect><rect x="45.00" y="45.00" width="58.24" height="58.24" rx="10.59" fill="none" stroke="#b69aff" stroke-width="7.94"></rect><rect x="79.41" y="79.41" width="55.59" height="55.59" rx="10.59" fill="#b69aff"></rect></svg>
```

## Task

1. Replace the contents of `apps/web/src/app/icon.svg` with the `favicon.svg` literal above, byte for byte. Keep the file name `icon.svg` (the app's existing convention).
2. Rasterise `apple-touch-icon-180.svg` to a 180×180 PNG and replace `apps/web/src/app/apple-icon.png` with it. Keep the file name `apple-icon.png` (the existing convention). The PNG must be a faithful render of the SVG: `#13112a` full-bleed tile, `#b69aff` mark, no transparency.
3. Render the PNG with tooling outside the repository (a macOS tool such as `sips` or `qlmanage`, or `sharp`/`resvg`/`rsvg-convert` run ad hoc from `$TMPDIR` or `npx`). Do not add any dependency to the UI workspace; `package.json` and `pnpm-lock.yaml` stay untouched. If nothing can rasterise the SVG, stop with `QUESTION:` and what you tried.

## Out of scope

- Mobile app icons and the splash (the mobile track), `favicon.ico`, web app manifests, OG/social images.
- Any other app file, component, style or test, unless the gate proves a test pins the old icon bytes — then fix that one test minimally and say so.
- No visible page change: only browser-tab and touch icon assets.

## Acceptance criteria

- `apps/web/src/app/icon.svg` equals the `favicon.svg` literal byte for byte.
- `apps/web/src/app/apple-icon.png` is a 180×180 PNG rasterised from `apple-touch-icon-180.svg`; no SVG sources are added to the app.
- No dependency, `package.json` or lockfile change.
- The web gate is green (checks below); the report names every exit code and the checked commit sha.

## Branch, network, files

- Branch: `web/site-icon` (if the harness assigns its own worktree branch, keep the assigned one and say so in the report).
- Network: only after the coordinator allows it. One narrow exception is pre-allowed: fetching a single SVG rasteriser (`sharp`, `resvg` or `rsvg-convert`) via npm/npx/Homebrew if no local tool works. Nothing else; report what was fetched.
- **Files you may change**: `apps/web/src/app/icon.svg`, `apps/web/src/app/apple-icon.png`, plus one test under `apps/web/src/**` only if the gate requires it.
- **Design**: /Users/dmitry/dev/block-and-tell-artifacts/handoff/mobile/design/icon-2026-11-04/
- **Plan**: plan if you need one (this is a small asset swap; any plan goes to the reviewer, not to the coordinator).

## When to ask (`QUESTION:`)

Only what the pair cannot decide: policy, scope, the owner's decisions — e.g. no rasteriser can be made to work, or a gate failure whose cause lies outside the allowed files.

## Setup and checks

- Fresh `origin/main` of `zakharov-dy/stable-story-ui` in your worktree; `pnpm install` in the worktree (this repository is its own workspace; do not touch any backend checkout).
- With `set -o pipefail`, real exit codes, output cut:
  - `pnpm typecheck | tail -40`
  - `pnpm lint | tail -40`
  - `pnpm test --reporter=dot | tail -40`
  - `env -u AI_AGENT -u CLAUDECODE pnpm check:build | tail -40`
  - `CI=true env -u AI_AGENT -u CLAUDECODE pnpm browser-smoke | tail -30`
- PR at the first push (CI is manual only; no run is expected). The final report has the full local run on the last code commit: every exit code and that commit's sha. Commit author is the configured owner identity — check `git log -1 --format='%an <%ae>'` before each push; keep the `Co-Authored-By` trailer of the model that wrote the code.
- The PR lists every deviation from the letter of `docs/architecture.md` (there should be none in this PR).

## Economy

No interactive browser and no screenshots (the headless `browser-smoke` is the only browser and it may not be needed here); no full reads of big files (grep, sed ranges); no rereads; cut outputs.

## Для ревьюера

Major threshold: wrong asset content or size (icon.svg not byte-equal to the export literal; apple-icon.png not 180×180 or not rendered from the given SVG, wrong colours or transparency); a dependency, `package.json` or lockfile change; a change outside the allowed files; a failing check reported as green (missing `set -o pipefail` or missing exit codes); a test weakened to pass. Everything else is minor.