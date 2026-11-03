# Testing the web page

How a change to the web page is checked. Two workflows share the same deterministic checks: the
design-comparison browser test is an extra step of workflow B only, and does one job — the comparison
with the design mockups.

## Workflow A: an ordinary front-end change

For a change that does not touch how the page looks against the design (logic, texts, data,
refactoring, fixes).

1. Run the local checks before the push (`CLAUDE.md`, "Commands"): `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm --filter @app/web check:build` (the build, the HTML of every mock state without
   JavaScript, the self-hosted fonts, the page icon), then `pnpm --filter @app/web browser-smoke`
   (the browser smoke, below).
2. Push the branch and open or update the pull request.
3. The pull request merges when the review approves and the local checks pass on its head.

`check:build` also runs the long-history leak check on the full `long-history` source HTML and inline
RSC: independently computed old daily markers must be absent from charts, props and hidden copies,
while legal records remain allowed, and daily points, the day equation and gap/mismatch controls must
remain present. It reuses the existing build and page request.

## The browser smoke

The deterministic browser check without a model and without screenshots is `browser-smoke`, described
next to the script in [`apps/web/browser-test/README.md`](../apps/web/browser-test/README.md)
("Browser smoke"). It runs before the push in both workflows and in the `web` job of the CI workflow,
which is manual only. A failure there is a defect of the page, not of the design.

The six-chain `long-history` coverage includes independent last-bucket level and share numbers for
30D, 90D and ALL, a supplied-share mutation to detect page-side arithmetic, null versus zero,
thin-layer label retention and midpoint placement, the sixth-chain slot identity, one resolution
sentence, and Last run without a repeated block. The other state tests cover common coverage,
delayed/unreconciled notes, closed-day zero versus gap, unpaired bridge identity and operation n/a,
disabled longer periods, empty and load-error blocks.

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

The design-comparison browser test (`browser-test`) does not repeat these checks: it compares the page
with the design mockups and nothing else. The smoke's live mode for a local run against a live API is
described in the README; `browser-test` has no live mode, because there is no mockup for a live page.

## Workflow B: a design change

For a change to how the page looks (layout, spacing, type, colors, charts, states) that has to agree
with the design mockups ([`design.md`](design.md)).

1. Steps 1 to 3 of workflow A, up to a pull request with the local checks passing and an approved
   review.
2. Before merging, run the design comparison on the branch of the pull request, in a build of that
   branch:

   ```bash
   pnpm --filter @app/web build
   pnpm --filter @app/web browser-test --model <model> --out <output folder> --design-dir <design export folder>
   ```

   The folder with the mockups stays outside the repository (an example command is in
   [`apps/web/browser-test/README.md`](../apps/web/browser-test/README.md)). The run is quiet (headless
   Chrome) and parallel (4 states at a time). It does the design comparison only; the technical checks
   have already run in `browser-smoke` (step 1), and a technical problem found there is fixed on the
   pull request before the comparison.
3. Read `design-diffs.json` and the per-state reports, and decide for each difference:
   - **fix**: correct the page on the same pull request, then run the comparison again for the
     affected states;
   - **accept**: the difference is a known and wanted departure from the mockup; write it into
     [`apps/web/browser-test/design-accepted.json`](../apps/web/browser-test/design-accepted.json) with a reason, and from then
     on it counts as accepted;
   - **ask**: the case is not clear; the owner decides.
4. When no difference is left that is neither fixed nor accepted, the change merges.

The comparison looks at structure and styles (blocks and their order, labels, fonts, colors, spacing,
widths) and ignores numbers, because the mockups have their own demo figures. Widths that have no
mockup are skipped, not compared with another width.

## Who decides pass or fail

The script does not. The exit code of `browser-test` reports a broken run only (an `agy` failure, a
state that did not run, an unreadable or incomplete report) and never depends on design differences or
on the page itself. Whether the page works technically is the exit code of `browser-smoke`; the report
of `browser-test` has no defects. The design check of a width is `pass` when every difference is on the
accepted list, `fail` while some are not, and `skipped` when the fingerprint data was altered or not
returned; none of this changes the exit code. Whether a design difference is acceptable is decided by
whoever runs the comparison, and only the owner overrules.
