AI review: on · reviewer commandcode · model deepseek/deepseek-v4.1-flash · effort high · rounds 3

# Showcase images: refresh `hero.png` and `charts.png` from the current page

## Why

`zakharov-dy/stable-story-ui` is the public showcase of Stable Story and will be linked from the owner's CV. Its README opens with two renders of the page (`docs/media/hero.png`, `docs/media/charts.png`) taken on 2026-11-07 before the last change. The page has since been rebuilt from the owner-accepted `Home-1107` boards: it now opens on the ALL period, has no chain chip, the Status section is at the bottom, the hero and the sticky bar are the new ones. `charts.png` still shows the 30D default and its caption still says "the 30D stack". This task replaces the two images with renders of the page as it is now and fixes the caption.

## Launch criteria

None — no `docs/requirements/launch-criteria.md` row changes (that file lives in the backend repository, not here).

## What to read

- `README.md` lines 30–50 (the "What the page shows" section, both images, both captions) and `docs/media/`.
- `apps/web/scripts/browser-smoke.ts` (the `--shots` catalog and how it builds/serves the page), `apps/web/scripts/browser-smoke-launch.ts` (how a state is rendered in headless Chrome), `docs/web-testing.md` (mock states).
- The accepted boards for the current look: `/Users/dmitry/dev/block-and-tell-artifacts/handoff/web/design/home-2026-11-07/` (`Home-1107-1280`, `Home-1107-sticky-bar-1280`). The sandbox allows reads outside your worktree; the `read` tool may refuse them, so use the shell. Do not copy the folder into the repository.

## Task

1. **`docs/media/hero.png`** — the first screen at exactly 1280×800: brand row, hero figure and the waterfall. Render it from the built page in a six-chain mock state with no demo banner (PR #10 used `long-history`; use the same or another demo-free six-chain state) and with no annotations.
2. **`docs/media/charts.png`** — exactly 1280×800, the stack and flows section with the sticky bar visible, on the **ALL** period (the page's new default), as the previous image did at 30D.
3. Both images show the current page: no chain chip, the current hero, the current sticky bar (no round button). The Status section is below these crops and need not appear.
4. **`README.md`**: make the charts caption describe what the image now shows (the ALL stack, flows and sticky control) and, if the text reads as if 30D is the default, say the page opens on ALL. Change nothing else: alt texts may stay as they are if still true.
5. Mechanism is yours: the repository's `browser-smoke --shots` (its catalog is a by-product) or a one-off Playwright script under `$TMPDIR` reusing `env -u AI_AGENT -u CLAUDECODE pnpm check:build`. Only the two PNGs and README lines may be committed.

## Out of scope

- Any change to `apps/web`, `packages/*`, the page's behaviour or tests; any new dependency; the `browser-smoke --shots` catalogue as a committed artifact; the social-preview 2:1 crop (owner-side); the working-name footnote.

## Acceptance criteria

- Both files are 1280×800, 8-bit PNG; the report includes `file docs/media/*.png` and `ls -l docs/media`.
- Each is at most 300 KB.
- The images show the current page with the ALL period active, no demo banner or annotation text; the sticky bar is visible in `charts.png`.
- The README caption matches the image; no other README change.
- No code, test, token, lockfile or `robots.txt` change; `git diff --stat` names only the two PNGs and `README.md`.
- The workspace checks below are green; the report names every exit code and the checked commit sha.

## Branch, network, files

- Branch: `web/showcase-images-2` (if the harness assigns its own worktree branch, keep the assigned one and say so in the report).
- No network beyond the worker's own installs; headless Chrome is local.
- **Files you may change**: `docs/media/hero.png`, `docs/media/charts.png`, `README.md` (only the lines about these images).
- **Design**: none (the page does not change; the images are renders of the accepted boards).
- **Plan**: plan if you need one (this is a small asset task).

## When to ask (`QUESTION:`)

Only what the pair cannot decide: e.g. no demo-free six-chain state can be rendered at 1280×800, or the page cannot be built in the sandbox.

## Setup and checks

- Fresh `origin/main` of `zakharov-dy/stable-story-ui` in your worktree; `pnpm install` in the worktree.
- With `set -o pipefail`, real exit codes, output cut: `pnpm typecheck | tail -40`, `pnpm lint | tail -40`, `pnpm test --reporter=dot | tail -40`, and the build needed for the render: `env -u AI_AGENT -u CLAUDECODE pnpm check:build | tail -40`. `browser-smoke` is not required unless you use it for the renders.
- PR at the first push (CI is manual only; no run is expected). The final report has the run on the last code commit with every exit code and its sha. Commit author is the configured owner identity — check `git log -1 --format='%an <%ae>'` before each push; keep the `Co-Authored-By` trailer of the model that wrote the change.

## Economy

No interactive browser and no screenshots beyond the two renders the task needs; no full reads of big files; no rereads; cut outputs.

## Для ревьюера

Major threshold: an image does not show the current page (chip, old hero, round sticky button, 30D active), a demo banner or annotation is visible, the size or format is wrong, the README caption contradicts the image, a change outside the allowed files, a dependency or code change, a failing check reported as green. Everything else is minor.