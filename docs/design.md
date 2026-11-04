# Web design: tokens and decisions

The visual language of `apps/web`. The tokens live in [`packages/tokens/src/tokens.ts`](../packages/tokens/src/tokens.ts) and generate [`apps/web/src/styles/tokens.css`](../apps/web/src/styles/tokens.css); the shared rules in `base.css`; each page part has its own file (`first-screen.css`, `charts.css`, `lists.css`).

Rules for code: colors, fonts and spacing only through `var(--…)`; inline `style` only for computed coordinates; every string from `texts.ts`. Token names are never renamed, only added to.

## Theme: Violet Observatory

A dark, blue-violet instrument panel: a deep background, a slightly lighter surface, hairlines instead of heavy borders, and a faint violet glow that appears only in empty space (the side gutters and under the composition, never under text or plots). Light theme is out of scope for the MVP.

## Tokens

[`packages/tokens/src/tokens.ts`](../packages/tokens/src/tokens.ts) is the source of the token values for web and React Native ([ADR 0025](decisions/0025-shared-design-tokens.md)). Regenerate the committed web CSS with `pnpm --filter @app/tokens generate`; the Design System artifact is rebuilt from repository tokens. What follows is the purpose of each token group and the rules for using it.

### Surfaces and text

Page and card backgrounds, with a raised chip for nested surfaces. Primary and secondary text (contrast above 8:1 on the background), dim text for fractional digits and axis dates (still above 5:1). Quiet hairline dividers, decorative only, against stronger interactive and emphasis borders. An accent for links, labels and the supply sparkline; a glow that lives only in empty space; a visible focus outline.

### Data colors

Issuer mint and burn, CCTP bridge in and out (hatched in charts), the net line, and ten chain colour slots in `overview.chains` order. A chain colour is never used for a flow (mint, burn, bridge, net) in the same chart. Positive and negative name the direction of a supply change and are deliberately lighter than mint and burn, so a change never reads as an issuer flow. Separate marks for a chain that is behind, a day or chain whose checks fail, a bridge event without a CCTP operation, missing or incomplete data (`n/a`) with its shaded column, and the zero line of every chart.

Slots 7–10 are reserved for chains not enabled yet and are re-checked when a seventh chain is enabled.
Their palette check uses WCAG contrast ≥ 4.5 on `--color-bg` and `--color-surface`, normal-vision CIE76 ΔE ≥ 20, and ΔE ≥ 14.2 under the Machado severity-1 protanopia, deuteranopia and tritanopia simulations, as approved on 2026-11-04. Comparisons cover the six enabled chain colours, five flow colours, positive/negative supply direction, delayed/unreconciled/unpaired/incomplete quality colours, and the other reserved chain slots. The incomplete shade uses the incomplete colour at 14% opacity.

| New token | Value | Purpose |
|---|---|---|
| `color-chain-7` | `#229165` | Reserved seventh chain colour |
| `color-chain-8` | `#a6814a` | Reserved eighth chain colour |
| `color-chain-9` | `#827b8a` | Reserved ninth chain colour |
| `color-chain-10` | `#9e83fa` | Reserved tenth chain colour |
| `sticky-bar-height` | `48px` | Height of the Home sticky bar |
| `opacity-dimmed` | `0.25` | Opacity of the other stack layers while a chain list row is hovered |
| `section-gap` | `96px` | Gap between Home blocks |

### Quality marks: component × state × token

What each block uses to mark a quality state; every cell is a rule of the stylesheets, nothing invented.
`—` means the state marks nothing in the block — the block is still drawn, the dash is not an absence.
Only `unavailable` is an absence: it draws the outage message, How we count and the disclaimer, so the
eight data blocks are "not drawn" there, while How we count is drawn in every state (without its
coverage line in `unavailable`) and marks nothing. A state can carry several flags at once — the
unreconciled mock state also has unpaired events and incomplete buckets — and the page then shows the
union of the columns: each cell lists the marks of its own quality class. The unpaired event mark
(`--color-unpaired`) is not a state of its own; it is listed with the state that carries unpaired
events. Which flags can reach a block's notes follows its source: 03 and 04 build their quality from
the chart series, which never carries unpaired events, while header, 05, feed and records take the
response's per-block quality, which can.

| Block | ok | delayed | unreconciled (mismatch) | gap | unavailable |
|---|---|---|---|---|---|
| header | — | `--color-delayed` | `--color-unreconciled`, `--color-unpaired` | `--color-incomplete` | not drawn |
| day equation | `--color-positive` | `--color-delayed` | `--color-unreconciled` | `--color-incomplete` | not drawn |
| 03 supply by chain | — | `--color-delayed` | `--color-unreconciled` | `--color-shade-incomplete`, `--color-incomplete` | not drawn |
| 04 drivers | — | `--color-delayed` | `--color-unreconciled` | `--color-shade-incomplete`, `--color-incomplete` | not drawn |
| 05 issuer vs bridge | — | — | `--color-unreconciled`, `--color-unpaired` | `--color-incomplete` | not drawn |
| feed | — | — | `--color-unreconciled`, `--color-unpaired` | `--color-incomplete` | not drawn |
| records | — | — | `--color-unreconciled`, `--color-unpaired` | `--color-incomplete` | not drawn |
| status | `--color-positive` | `--color-delayed` | `--color-unreconciled` | `--color-incomplete` | not drawn |
| How we count | — | — | — | — | — |

### Type, space, shape, motion

A sans for text, a mono for figures, which always use `tabular-nums`. Mono labels and axes run up to section headlines; uppercase labels and column heads carry their letter-spacing while display figures keep their own negative tracking. Figures step down at phone width (set in a media query). A spacing scale with a wide page gutter that narrows at phone width; a capped content width; radii for cards, chips, tags and legend swatches; stroke widths from hairline sparklines and area edges up to the net line, with the last point of a sparkline drawn as a zero-length round-capped line; compact sparkline heights at phone width; the period of the bridge hatch. Motion has a hard ceiling for hover, rows and cards; `prefers-reduced-motion` switches transitions off.

## Fonts

Self-hosted from npm (`@fontsource/space-grotesk`, `@fontsource/ibm-plex-mono`, latin subsets), imported in `src/app/layout.tsx`. `next/font/google` is not used and neither the build nor the browser contacts `fonts.googleapis.com` or `fonts.gstatic.com`; `pnpm --filter @app/web check:build` fails if either host appears in `.next/static` or in a page's HTML, or if no `.woff2` is shipped.

## Design decisions

- **First screen is A + B, no switcher.** The big supply figure (A) and the per-chain day equation (B) are shown together; there is no view toggle in the MVP.
- **The day equation per chain.** For each chain the day reads as an equation of the change in supply: issuer mint, issuer burn, bridge in, bridge out. The reconciliation chip names the failed check (supply, bridge or continuity). When a chain is behind, the chip reads "◇ unreconciled day" or "✓" for the day that is shown.
- **Hatching is the bridge.** Bridge flows are hatched (`--hatch-size`), issuer flows are solid. An unreconciled day is dashed.
- **Each drivers view is on its own scale.** Section 04 shows one chart per view (All chains, then every chain): the views do not share a value scale, every view reads `± max` and `± half` of its own data per day, with horizontal gridlines at those four values and the zero line. The section names no number; each view's bound lives in the view's own accessible name, and the scale note names the scope (`Scale: all chains, USDC per day` for the All view, the chain's name otherwise).
- **The section 04 toolbar: chain switch left, period echo right.** Under the heading a single chain radio group (`All chains` first, then every chain of `overview.chains` in order, default All) reuses the segmented look of the period switch; a delayed chain carries the board's dot with its lag as the title and a hidden lag for screen readers. The dashed pill on the right is not a second switch: it links to the page-wide switch (`#period`) and only shows its state — the value follows the checked period radio by CSS. The chain rules match views by position (`data-pos`, 0 = All), covering the registry's six chains, and the styling has six palette slots: a chain beyond the registry bound (a 7th and later) renders with the default swatch, and all views stay readable. Sections 03 and 05 keep three copies each, one per period, at the resolution the policy permits (the period switch below), never every day of the history; section 04 is one section whose per-period text and period × view figures hide through combined `:has` rules on `.period-group`, so each radio group is single for the whole page and both choices survive each other.
- **The drivers chart is lines and soft areas (04).** Issuer flow is a gradient area (42 % at the flow edge, 6 % toward zero) with a solid 1.5 px edge, mint above zero and burn below; bridge flow is a hatched band stacked outside the issuer band with a dashed 1.5 px edge (`4 3`), so "hatched = bridge" holds as fill and as line. The net is a 2.5 px `#f5e5ae` line with round joins, a 3.5 px dot on the last day, and a dashed (`3 4`) final segment when the last day is unreconciled. One area and one edge path per run of known days: a gap day splits every band, an unknown value is never drawn as 0, and a closed day with no events keeps its zero tick. Y labels sit at the right edge in the mono small dim style, compact with a sign and no trailing zeros (`+1.25B`, `−500M`); an all-zero view reads one `0` on the zero line.
- **The supply chart is a calm stack.** Section 03: each layer is its chain colour at 86 % with no stroke, the only separator a 1 px `--color-surface` hairline between neighbouring layers, and the level panel wears the total line (1.5 px `--color-text` at 92 %) along the top edge of the stack. The level domain is the data maximum plus 5 %, rounded up to the next whole axis step (1, 2, 2.5 or 5 × 10^k steps), so three or four `--color-hairline` gridlines sit at the steps and the axis reads `0`, `20B`, `40B`, `60B` — `formatCompact`, no trailing zeros, right-aligned at the right edge in the mono small dim style. The share panel keeps 0–100 %.
- **Direct labels name every chain at the right edge of the level panel.** One desktop column runs from the top layer down in reverse stack order, anchored at the top layer's midpoint in the last bucket, with exactly `--chart-chain-label-step` (30 px) between labels. No overlap rule drops a chain. Each label shows the chain dot/name, compact level from the ready level series and one-decimal share from the ready share series, matched by chain and bucket; the page never derives a share from a total. Null shares read `n/a`. On phones the full legend is a row under the level chart, in chain order, with each compact level and without the shares.
- **Notes and tags.** `.qnote` is a quality note with a key label (unreconciled, delayed, gap or unpaired); `.tag` is a short mark (delayed, unrec, unpaired, peer, cctp, nodata). `n/a` always comes with the reason under it (`.na-why`).
- **One tooltip per chart, structured on the server.** The supply chart's card has a `Tracked supply` header with the ready total and `100%`, one row per chain (colour dot, name, compact level, one-decimal share), the date and `end of day`, `level at week end` or `level at month end`, and a quality line above the footer when needed. Each drivers card (04) starts with issuer mint, issuer burn, bridge in, bridge out and then net after a hairline: solid squares for issuer, hatched squares for bridge and a net bar. Its date footer says `sum per day/week/month, <scope>`; there is no duplicate scope header. Missing values stay missing and cut calendar buckets say `incomplete period`. Every string comes from the server; the client places the single card, dashed 1 px crosshair, markers and axis date chip, and flips the card left near the right edge. Keyboard focus does the same. Chart 03's level plot marks each known layer boundary; its share plot has no hover markers. Chart 04 marks only net. Markers use `--chart-hover-marker-size` (5 px diameter), chain/net fill, `--stroke-hairline` and `--color-bg` border. On phones a touch tap on chart 03's level plot pins the card above it with a close button; pointer leave and blur keep the pin, close/Escape dismiss it, and another chart can take the card. The pin occupies a separate grid row outside the measured plot, while both axes stay aligned with the plot. Without JavaScript each column keeps its SVG title; after hydration structured charts remove native titles and keep accessible names, so a second browser tooltip cannot appear. Other charts keep the plain-string card.
- **Sections.** Each section has a `/// 0N` label, a headline and a caption on the right (`SectionHeading`); the rhythm is 136 px between sections (96 px at phone width).
- **Fonts are self-hosted**, see above.
- **Dates: the year in the header, not in the sections.** The header (`Data through Oct 9, 2026`), the records and the line of How we count carry the year; the range of the whole history has it once, at the end (`Aug 26 – Oct 9, 2026`). Everywhere else a day is `Oct 9` and a range `Sep 10 – Oct 9`: titles, captions, drivers, issuer vs bridge, the feed (`Oct 6 · 14:03 UTC`), the status, tooltips, axis labels and quality notes. A range that crosses 1 January puts the year on both ends (`Dec 20, 2026 – Jan 3, 2027`), and so does a list of days spread over two years. One set of functions in `format.ts` does it.
- **A chain that is behind is named once, where the chain is not already named.** Header and status: `Base · 30 h behind`. The chain's own cards drop the name: day equation `30 h behind · Oct 9 not closed`, drivers `30 h behind`, and a layer label of the supply chart `30 h`. The unreconciled chain is named in the header (`◇ Ethereum · Oct 9 unreconciled`) beside the date, for each chain whose last closed day is among its mismatched days.
- **Notes in the header.** A delayed chain and missing data (gap, short history) go above the cards, next to the date; unreconciled days and unpaired events go below the issuer line.
- **n/a says what is missing.** When the cause is the start of the history, the reason names the days from `asOf` and `historyStart` (`needs Oct 2, before history starts (Oct 3)`, `Sep 26 – Oct 2 is before history starts`).
- **Records.** A card shows its day with the year, or `n/a` with its reason. The section has one quality note under the heading; with no operation card the four cards fill one row.
- **Sparklines are squeezed into their box.** The plot has `preserveAspectRatio="none"` and a fixed height at phone width, so what must stay round is not drawn in it: the last point is a zero-length line with a round cap, a flagged day is an HTML diamond over the plot.

## Screenshot catalog

The screenshot catalog is a folder of PNGs for the eye; it has no reference images and no comparison, and it never enters git. `browser-smoke` makes it on request, keeping every check it always runs:

```bash
pnpm --filter @app/web build
pnpm --filter @app/web browser-smoke --shots .shots                                   # every mock state at both widths
pnpm --filter @app/web browser-smoke --states ok,long-history --shots .shots          # just the states the catalog needs
```

The script runs in `apps/web`, so `.shots` is `apps/web/.shots`, the default folder; `BROWSER_SMOKE_SHOTS` does the same (`0` and `false` turn it off, `1` and `true` take the default folder). With neither, the smoke takes no screenshot. What lands in the folder: the full page of every mock state at `1440x900` and `375x812` (`<state>-<width>x<height>.png`), and on the six-chain `long-history` state sections 03, 04 and 05 at each period, 30D, 90D and ALL (`long-history-<width>x<height>-<period>-03|04|05.png`), after checking the period switch. Any other folder works, a temporary one included; PNGs are never committed.

## Deliberate differences from the mockups

- **Launch board chain order follows the API in code.** The accepted `Launch-*` boards put Avalanche fifth and Polygon sixth. `overview.chains` puts Polygon fifth (`--color-chain-5`) and Avalanche sixth (`--color-chain-6`). The team accepted keeping API/registry order: colours and desktop direct-label positions differ for these chains, and the boards are corrected to match. The page never reorders chains.
- **Load-error coverage is omitted.** `Launch-state-error-*` retains a fifth How we count item with illustrative chain/history values. On a data-read failure (published overview in production, local API during development) the page retains only the four static items; it has no overview from which to state chains or coverage (an accepted clarification).

- **One caption per section, not one per state.** The design mockups carry their own captions for the status and the supply chart (`Base has not closed Oct 9 yet…`, `The axis ends on the common date…`). The page keeps one caption and says the state in the header notes. The exception is the supply chart with a short history, which gets the caption (`History since Oct 3, 2026, the first day closed on every chain…`): it is the only place that explains why the chart is short.
- **Issuer vs bridge on a partial period reads `n/a`.** The mockup shows the shares of the covered part with a `period incomplete` mark. The contract ties a share to a known denominator (`issuerShare` is `null` otherwise), so the page shows `n/a` with its reason and does not compute a share of its own.
- **The time of a status row is `Oct 10 · 05:57 UTC`**, the format of the feed, not the mockup's `Oct 10 05:57`. Last run appends its result only (`· ok`); block numbers appear only in Last block.
- **A chain's lag in the status and the header names the chain** (`Base · 30 h behind`); only the chain's own cards drop the name.
- **`closed · no events` follows the daily event count (`drivers[].events`), never the flows.** An event may have a zero amount, so four zero flows do not prove that a closed day had no events. The day card of a chain gets the muted tag `closed · no events` exactly when the card's day (the bucket of `drivers` that ends on `asOf`) is closed for the chain and its count is `0`; a chain or a day missing from `drivers`, a day that is not closed (`null`) and a day with events get none. The drivers chart (04) draws the zero tick, the legend entry and the note `0 · <days> · closed, no events` from the same count. A closed day with zero flows but events (zero-amount events) is a real zero, not a gap: it has no bars, the net line passes through zero, and it gets no tick, no note and no legend entry.
- **The tag on the day card is not visible in the mock catalogue.** The mock `empty-day` state has its empty day (Sep 15) in the middle of the thirty days, while the card shows `asOf`; the tag is checked in unit tests on clones that are parsed by the contract, not on the mocks.
- **The unreconciled chip names the failed check** and the tag reads `◇ unreconciled day` (see above).
- **One period switch for the chart block, default 30D.** A single radio group (`30D · 90D · ALL`) sits
  above sections 03, 04 and 05. The server renders every period of each section at the resolution the
  view policy permits — 30D by days, 90D by weeks (an exact 90 days until the owner decides otherwise),
  ALL by calendar months from the earliest closed day of any enabled chain through `asOf`, so a chain
  that starts earlier shows that earlier history (`historyStart` stays the common coverage the header
  and records use) — with every chain in every period; each copy
  holds that resolution and never every day of the history. The page renders the step the server declares:
  it builds no buckets and never sums chain levels. CSS shows the period the checked radio names, so the
  switch works without JavaScript and the browser fetches nothing for it (the charts still hydrate their
  tooltips). It drives sections 03, 04 and 05 (03 and 05 as three copies, one per period; 04 as one
  section whose per-period text and period × view figures hide through combined `:has` rules). The
  header, day equation, feed, records and status keep their own fixed windows and never follow the
  switch. A period that would show no more days than the previous one is disabled: 90D below 90 days of
  history, ALL at 90 or fewer. Section 04 adds its own single chain group next to the switch (see the
  toolbar rule above); the two groups combine on `.period-group`, one chart per view per period.

## After the MVP

- **Constellation of chains**: a decorative JavaScript layer. A node is a chain, its size is the level, its ring is `status.state`, the threads are the issuer mint. Switched off with `prefers-reduced-motion`.
- **Arcs between chains** (MVP 2.0): need cross-chain CCTP flows in the API.
- **A switcher of home views.**
- **A light theme.**
