# Browser test of the web page

Two commands check the page in a real Chrome, and they do different jobs:

- `browser-smoke`: the technical checks (console, network, HTTP, overflow, fonts, page state and blocks, chart hover, tone colors). Deterministic, no model, in CI and locally (below); screenshots only when `--shots` asks for the catalog.
- `browser-test` (this page, the rest): the comparison of the page with the design mockups, done by the `agy` CLI. For each page state a dedicated agent, `browser-tester`, opens the page at the given widths, fingerprints it and the design mockup of the same state and width, and returns the differences as JSON. It runs no technical check.

`browser-test` is not part of CI: it needs `agy` and Chrome. Who uses it and when: [`docs/web-testing.md`](../../../docs/web-testing.md) (workflow B, run by the maintainers).

## Browser smoke (no model)

`pnpm --filter @app/web browser-smoke` (`scripts/browser-smoke.ts`) does all the technical checks of the page: the same states, the same widths as `browser-test`, no model and (unless `--shots` asks for the catalog) no screenshots, so it is quick (about half a minute for all states) and runs in CI (job `web`, after `check:build`, on its build).

```bash
pnpm --filter @app/web build                                                     # once; CI reuses the build of check:build
pnpm --filter @app/web browser-smoke                                             # all mock states, 1440x900 and 375x812, one after another
pnpm --filter @app/web browser-smoke --states ok,empty --viewports 375x812
pnpm --filter @app/web browser-smoke --shots .shots                        # the same checks, plus the screenshot catalog in apps/web/.shots (docs/design.md)
pnpm --filter @app/web browser-smoke --live --api-url http://localhost:8080      # one run on a live API, state "live", for local use
```

- **Browser.** The installed Google Chrome through `playwright-core` (`channel: 'chrome'`); nothing is downloaded. `BROWSER_SMOKE_CHROME_BIN` points to another Chrome binary. Exit code 1: a check failed; 2: a usage problem (no build, no Chrome, a bad option) or a screenshot of the catalog that could not be taken.
- **Screenshots on request.** `--shots <dir>` (or `BROWSER_SMOKE_SHOTS`, where `0` and `false` switch it off, `1` and `true` take the default folder) adds the screenshot catalog after the checks: the full page of every state and width that runs, and on the six-chain `long-history` state sections 03–05 of every period (30D, 90D, ALL) with the period switch checked. The default folder is `apps/web/.shots`, gitignored; PNGs are never committed. The checks are the same with and without the option (the captures use their own page context), and a capture that cannot be written fails the run with exit code 2. There are no reference images and no comparison. The recipe: [`docs/design.md`](../../../docs/design.md).
- **How.** Per state `next start` (`API_MODE=mock`, `MOCK_STATE`, a free port; `scripts/next-server.ts`, shared with `check:build`); per width a fresh browser context. Chrome resolves only the local host (`--host-resolver-rules`), so a request to another origin is made, recorded and fails. Requests and responses are read from the DevTools Protocol, because Playwright's own events leave out `/favicon.ico`; a favicon 404 therefore fails the network check. The Chrome sandbox stays on, and is switched off only under `CI=true` (Playwright would otherwise add `--no-sandbox` always).
- **Where the rules are.** The checks are pure functions over the collected data (`scripts/browser-smoke-checks.ts`, tested in `browser-smoke-checks.test.ts`): console, network, http, overflow, fonts, page-state, chart-hover, tone-colors. Counts come from the shared lists and the mock catalogue (`src/checks/page-html.ts`, `createMockClient`); the one literal is `OK_SVGS` in `scripts/browser-smoke-checks.ts` (the svg count of the `ok` state).
- **The checks in detail.** Console: a failed request is a problem. Network: `data:` and `blob:` URLs are not network and are allowed. Fonts: at least one `.woff2` was loaded. Demo label: absent on a mock state is a failure. Chart hover: every hoverable chart must show a non-empty, visible `.chart-tip` (rendered, not `display: none`, hidden or transparent). Tone colors: the class follows the tone (`pos`, `neg`, `neu`) and the colors of the tones present on the page differ. The hydrated DOM must also meet the whole HTML expectation of `checkPageHtml` (the one `check:build` applies to the server HTML).
- **Not inside a sandbox that cannot start Chrome.** With `BROWSER_SMOKE_UNSUPPORTED_SANDBOX` set the smoke prints a notice, exits with code 2 and does not start Chrome: Chrome aborts at startup there and macOS shows a crash dialog per launch. It is not a pass; CI runs the smoke.
- **No fixed sleeps.** The tooltip is client-rendered, so hovering a chart until its tooltip shows (re-hovering inside a bounded wait of 5 s) is also the wait for hydration; a tooltip that does not appear is the failure. Fonts and the idle network are waited for with bounded conditions.

## Requirements

- `agy` in `PATH`, signed in.
- Google Chrome. The path defaults to the macOS app; set `BROWSER_TEST_CHROME_BIN` to use another binary.
- A production build: `pnpm --filter @app/web build`.
- Free web ports (default 3100 and up, one per slot) and, with `--design-dir`, a free port 3190.
- The folder with the design export (it stays outside the repository, see below). Without it every check is `skipped` and the run compares nothing.

## Run

```bash
pnpm --filter @app/web browser-test --out <output folder>            # all mock states, 1440x900 and 375x812, 4 at a time, headless
pnpm --filter @app/web browser-test --out <dir> --states ok,empty --viewports 1440x900
pnpm --filter @app/web browser-test --out <dir> --design-dir <design export folder>   # with the design check
pnpm --filter @app/web browser-test --out <dir> --dry-run                                # print the slots, the queue and the commands, start nothing
```

Options (there is no live mode: there is no mockup for a live page, so there would be nothing to compare; for a live API use `browser-smoke --live --api-url <url>`):

| Option | Default | Meaning |
|---|---|---|
| `--out <dir>` | required | Where the reports go; outside the repository. |
| `--states a,b` | all mock states | The states to test. |
| `--viewports WxH,...` | `1440x900,375x812` | The widths to test; the design check uses the mockup of the same width. |
| `--model` | required | The model the `agy` CLI runs. |
| `--concurrency N` | 4 (1 to 8) | How many states run at the same time. |
| `--port` | 3100 | Page port of slot 0; slot i uses `port + i`. |
| `--design-dir <dir>` | none | The folder with the design mockups (outside the repository). |
| `--design-port` | 3190 | Port of the local server that serves the mockups. |
| `--headed` | off | Chrome with a window, for debugging by eye. |
| `--dry-run` | off | Print what would run. |

## Quiet, parallel runs

- **Headless.** Chrome starts with `--headless=new`: no window appears and nothing takes the focus. `--headed` shows the windows.
- **Slots.** The states form one queue, worked off by `--concurrency` slots; a slot that is free takes the next state. The short states (`empty`, `unavailable`, about 100 s each) go last, the others (about 250 s) first. Slot i has its own page (`next start` on `port + i`), its own Chrome (debugging port `9223 + i`; profile `<chrome profile folder>` for slot 0, `<chrome profile folder>-<i+1>` for the others) and its own agent whose only MCP server is that Chrome. The debugging port of the owner's other Chrome (`PROTECTED_PORT` in the script) is never used or probed.
- **A Chrome that already answers** on the port of a slot is used as it is and is not closed; otherwise the script starts its own and stops it at the end. Everything the script started (pages, Chrome, `agy`, the mockup server, the generated agent files) is stopped at the end, on errors and on Ctrl+C / SIGTERM.
- A slot whose Chrome does not start takes no states; if no slot can, the states are reported as `NOT_RUN` and the run fails.

## The design check

Needs `--design-dir <folder>`: the folder of the design export (`*.dc.html` mockups with `bt.css`, `ab.css`, `page.css` next to them). The mockups are never copied into the repository. Without the option the check is `skipped` ("no design dir").

- **Which mockup.** One mockup per state and width (`scripts/browser-test-design.ts`, `DESIGN_FILES`): 1440 for `ok`, `delayed`, `unreconciled`, `gap`, `empty-day`, `empty`, `unavailable`; 375 for `ok`, `unreconciled`, `empty`, `unavailable`. Where there is no mockup for the width (all of `short-history`, 375 of `delayed`, `gap`, `empty-day`, any other width, the `live` run) the check is `skipped` with the evidence "no mockup"; the 1440 mockup is never used instead. A folder that lacks a file the run needs stops the run before anything starts (exit code 2).
- **How the tester gets it.** The script serves the folder over plain HTTP on `127.0.0.1:3190` (flat files of known types only; no scripts, so `support.js` is a harmless 404; the fonts come from the font host in the mockup, which is not checked). The tester opens the mockup in the same tab as the page.
- **The fingerprint.** [`fingerprint.js`](fingerprint.js) is one function that the tester runs with `evaluate_script`, the same way on the page and on the mockup. On the page it stores the fingerprint of the page in `window.name`; after the tab navigates to the mockup (same site, so the name survives) the same call fingerprints the mockup, compares and returns the differences. It covers, for each `data-block` in document order (the mockup's `section.ab-eq` is the page's `day-equation`): presence and order, x and width, number of grid columns, number of `[data-kpi]` (the numbers of flows and chain states depend on the data and are not counted), charts (svg at least 120x60 px), small svgs and legend items, the label texts (digits masked) and the computed styles of the key elements (font family, size, weight, line height, letter spacing, case, color, background, padding, margin, gap, border, radius). Numbers are never compared; pixel values (also the fractional x and width of a block) closer than 2 px are equal. A block of the page that the mockup does not draw is a `presence` difference like any other (some mockups show only part of the page); intentional departures are accepted through `design-accepted.json`. Targets whose presence depends on the data or the markup (tag variants, chain names, chips, notices, cards, links, table cells) are compared only when both sides have one; a missing section label, title, caption, KPI card, big figure or full amount is reported. The empty page's `no-figures` block is compared with the mockup's `header`; the notices list `ul.qnotes` gives the notice its margin and is not taken for the first grid; the first card is one without a delayed or unreconciled mark. Labels and styles are compared; the values of cards, chips and charts, with their signs and suffixes, are not.
- **The result.** The tester copies every difference of the fingerprint into `design_diffs` (`source: "fingerprint"`) exactly as returned, never retyping a value, and writes a `note`; it may add up to 10 more structural differences it saw by comparing the accessibility snapshots of both (`source: "model"`). At most 200 fingerprint differences are listed per width; the full number is `design_diffs_total` of that width in the report. If `window.name` is lost or the call does not return mode `compared`, the check of that width is `skipped` with the answer as evidence (the tester may repeat the whole procedure once, never by hand).
- **The guard against altered data.** After the run the script rejects a `fingerprint` difference that `fingerprint.js` cannot have produced (`annotateDesign`, `fingerprintProblem` in `scripts/browser-test-design.ts`): a property name the fingerprint does not emit (the names are read from `fingerprint.js` itself: `root` or a target of `TARGETS`, then a name of `PROPS`; or presence, order, texts, x, width, the counts, `marks.*`, `styles.<target>`), a padding or margin that is not the 4 parts `four(...)` builds, an x or width that is not a pixel number as `show(...)` writes it. Other values (gap, border, radius, colors, fonts) are raw computed values and only their names are checked. One rejected item discards all `fingerprint` differences of that width: they go to `rejected_design_diffs` in `<state>.report.json` (not to `design-diffs.json`), the design check of the width becomes `skipped` ("fingerprint data altered: N item(s) rejected"), and `summary.json` counts them as `designRejected` (the table shows "altered, rejected"). Run the state again to get a trustworthy comparison.
- **Accepted differences.** [`design-accepted.json`](design-accepted.json) is a list of `{state?, viewport?, block, property, reason}` that the script applies after the run: a matching listed difference gets `accepted: true` in `<state>.report.json` and is counted as accepted, not as a difference. A width whose listed differences are all accepted (and none is cut off by the limit) gets the design check `pass` with the evidence "N differences, all accepted", whatever the tester wrote; with some not accepted it stays `fail`. `summary.json` and the table agree. The tester does not see the file.
- **The exit code does not depend on design differences.** Whether a difference passes is decided by whoever runs the test (see `docs/web-testing.md`).

## Output

In `--out`: per state `<state>.envelope.json` (the raw `agy` output; `<state>.agy-stdout.txt` if it was not JSON), `<state>.report.json` (the parsed report, with `accepted` on each design difference), `summary.json` (per state: slot, `agy` status, `designDiffs`, `designAccepted` and `designRejected`, missing tools, tokens, duration, parse error), and with `--design-dir` `design-diffs.json` (the differences that are not accepted, over all states). A short table goes to stdout. The exit code is not zero on an `agy` failure, a state that did not run, or a report that did not parse or lacks a requested width or its `design` check. It reports a broken run only: it depends neither on the page (that is `browser-smoke`'s exit code) nor on design differences.

The report shape is `browser-test/report.schema.json`, the prompt template `browser-test/prompt.md`. `agy` does not always honor `--json-schema`, so the script takes `structured_output` when it is valid and otherwise the last valid JSON block of the answer, and checks the shape itself.

## Why its own agent

`.agents/agents/browser-tester.md` isolates the run by browser and by foreign rules: `inheritMcp: false` with its own `mcpServers` leaves the model one browser, the test Chrome (`chrome-test`), and `inheritCustomizations: false` keeps global rules written for other work out. Tools are not restricted: the prompt directs the work. The full tool list includes `finish`, which `agy` needs to return `structured_output` for `--json-schema`; without it the report only comes back as text.

The Chrome port is written into the agent file, so each slot after the first gets its own copy, `.agents/agents/browser-tester-slot<i>.md` (ignored by git), made from this file with another port and name when the run starts and removed when it ends. The MCP server is pinned (`chrome-devtools-mcp@1.11.0`): with `@latest` an unreachable npm made the server take about four minutes to start.
