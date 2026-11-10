# Testing the web page

How a change to the web page is checked locally and in CI.

## The gate

1. Run the local checks before pushing (`CLAUDE.md`, "Commands"): `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm --filter @app/web check:build` (the production build, the HTML of every mock
   state without JavaScript, self-hosted fonts, the page icon, and the R2/window leak checks), then
   `pnpm --filter @app/web browser-smoke` (the headless Chrome smoke below).
2. Push the branch and open or update the pull request.
3. The pull request merges when the review approves and the local checks pass on its head.

`check:build` also runs the long-history leak check on the full `long-history` source HTML and inline
RSC: independently computed old daily markers must be absent from charts, props and hidden copies,
while legal records remain allowed, and daily points, the day equation and gap/mismatch controls must
remain present. It reuses the existing build and page request.

## The browser smoke

The deterministic browser check without a model and without screenshots is `browser-smoke`
(`apps/web/scripts/browser-smoke.ts`). It runs before the push and in the `web` job of the CI
workflow, which is manual only.

The six-chain `long-history` coverage includes independent last-bucket level and share numbers for
30D, 90D and ALL, a supplied-share mutation to detect page-side arithmetic, null versus zero,
thin-layer label retention and midpoint placement, the sixth-chain slot identity, one resolution
sentence, the ALL default with the ALL · 90D · 30D order in both period switches, the always-open
Status section (table plus phone list, no disclosure), and Last run without a repeated block. The
other state tests cover common coverage, delayed/unreconciled notes, closed-day zero versus gap,
unpaired bridge identity and operation n/a, disabled longer periods, empty and load-error blocks.

`scripts/browser-smoke-launch.ts` runs on six-chain overviews in the smoke. It checks all three
selected periods, all six visible direct labels, the 30 px step, desktop/mobile label content, keyboard
markers and edge flip, native-title removal, date and incomplete quality, chart 04's first
row/footer/net marker, and Last run cell bounds at 1280. Phone collection uses `hasTouch: true`; a
real tap pins chart 03 above the measured plot, then taps Close tooltip and checks dismissal plus both
axes' alignment. Chart 04 does not pin. Both sizes come from `packages/tokens/src/tokens.ts`; the
token drift test checks the regenerated CSS.

For screenshot evidence use only the six-chain state:
`pnpm --filter @app/web browser-smoke --states long-history --shots <dir>`. The catalogue names are
`long-history-1440x900.png`, `long-history-375x812.png` and
`long-history-<width>x<height>-30d|90d|all-03|04|05.png` (20 files total). These are artifacts for a
manual comparison, not committed fixtures.
