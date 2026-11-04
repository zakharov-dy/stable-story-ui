# Web design

The home page uses the Violet Observatory dark theme. A flat page background, quiet hairlines and surface steps provide depth. The accepted Home boards define the layout at 1280 and 390 pixels, with a 320-pixel stress width for wrapping and readable figures.

## Tokens and fonts

The typed source in packages/tokens/src/tokens.ts generates apps/web/src/styles/tokens.css. Colours, fonts and spacing use CSS variables. Inline styles position computed chart geometry. Token names remain stable. The page uses the shared 48-pixel sticky-bar-height, opacity-dimmed for layer emphasis, and section-gap for the 96-pixel block rhythm.

The native-app tokens tab-bar-height, touch-target, tab-indicator, row-height-chain, row-height-ledger, row-height-operation, skeleton-pulse and radius-sheet size the mobile tab bar, list rows and data sheet and time the loading skeleton pulse.

Space Grotesk provides body text and section headings. IBM Plex Mono with tabular figures provides numbers, axes, data columns and controls. Fonts are self-hosted from npm. Builds and browsers load the shipped WOFF2 files from the page origin.

The monument is 128 pixels on desktop and 64 on phones. Section headings use the 20-pixel sans size, body text 16 pixels, captions 14 pixels and data labels 12 pixels. Labels wrap. Figures remain fully readable at 320, 390 and 1280 pixels.

## Page composition

The brand row carries the wordmark, tagline and data date with its year. Direct delayed-chain notes name the chain and supplied lag. The chain-dot disclosure beneath it opens the status table. The brand tally uses the supplied reconciled-chain count and enabled registry size. The quiet stamp reads the supplied mismatched-day and closed-chain-day counts. A current-chain tally is shown only when a ready field exists. Every enabled chain appears in API order.

The hero pairs the tracked supply figure with its daily and seven-day changes. The five-column day waterfall reads issuer mint, issuer burn, bridge in, bridge out and ready net from the scope-all day row. Its caption contains the page's single /// marker and the day. Unreconciled notes sit beneath the figure and affected net marks are dashed.

The supply block follows the hero. Desktop places the stack beside the chain list. Phones place the list before the plot. Each list row carries the chain colour, full name, latest ready level, share, daily net and reconciliation or lag mark. The Level and Share controls show one panel at a time. The USDC lane label reserves a consistent header for an additional asset lane.

What moved it shows the selected period range and the ready issuer shares of inflow and outflow. A separate sentence carries the seven-day issuer mint and burn figures. Wrapping chips choose All or a chain for this block. Every chart uses its own value scale.

Largest operations shows the first five supplied rows in server order and names its own seven-day window. Each complete row links to its explorer transaction. Additional supplied rows appear through Show all N. A response with at most five rows has no disclosure. Bridge routes show their peer, direction and version, with unknown peers and unpaired operations explicitly marked.

Records filters the supplied records to scope all and presents their values and dates in a plain line, with two columns on phones. It names its own since date. The method block contains the concise counting explanation, the sentence about untracked bridge domains and the disclaimer.

The 48-pixel sticky bar appears after the hero has left the viewport. It carries the wordmark, data date, synchronized period control and status disclosure button. Phones show the logo in place of the full wordmark.

An unavailable response shows the wordmark, Data unavailable, its explanation and Reload. An empty response shows the brand row, no-closed-day message and enabled chain dots. These state boards have no method or disclaimer.

## Periods and document ownership

Every displayed amount, percentage and date is selected from the Overview document and formatted. The page never derives metric totals, differences, shares or time buckets. The waterfall uses the supplied scope-all row. Chart axes, paths and positions are rendering geometry.

The main native radio group works through CSS with JavaScript disabled. It drives the stack and flows. The sticky copy synchronizes it after hydration. A period change keeps the selected chain and Level or Share mode. Availability follows the server coverage policy, with a visible reason for disabled longer periods.

30D uses supplied daily buckets, 90D supplied weekly buckets and ALL supplied monthly buckets. The visible sentence explains that older periods are shown by week and month. The build window check rejects older daily chart values in HTML and RSC.

## Charts and colours

The first six chain colour slots follow the enabled API order. Slots seven through ten reserve space for future chains. Those reserved colours stay readable on both surfaces and meet the palette checks for common colour-vision deficiencies, while their mutual separability remains a tradeoff to review when enabling those chains. A chain beyond the reserved slots uses the default readable swatch. Thin layers remain identifiable through the chain list. Hovering or focusing a chain link row leaves its layer visible and dims other layers with opacity-dimmed.

Stack layers use chain colours at 86 percent opacity with one-pixel surface separators. The level panel carries the ready total line. Its axis rounds the data maximum with five-percent headroom to whole steps. Share uses a fixed zero-to-100-percent domain. A record peak is annotated when its supplied date lies in the selected period.

The stack reads supplied cumulative boundaries and noDataChains. Before a chain's coverage its row says no data and its layer is absent. Known layers remain drawn using their ready boundaries. An unexpected missing value remains a gap. Null never becomes zero.

Issuer flows use flat 18-percent fill and a 1.5-pixel edge. Bridge bands are hatched with a dashed edge. Net is a 2.5-pixel gold line with a final marker. A final unreconciled segment is dashed. Gaps split paths, and an explicitly closed zero-event bucket retains its zero tick. The supplied bucket range explains a cut week or month.

A chain colour never represents a flow. Issuer mint, issuer burn, bridge in, bridge out and net each use their own token. Positive and negative colours indicate changes. Quality marks use delayed, unreconciled, incomplete and unpaired tokens. Axis labels sit at the right edge and retain their text size as the plot width changes.

## Quality and interaction

Every state-carrying element retains data-chain-state. Quality-carrying elements retain data-quality, including delayed and unreconciled mocks. The disclosure table presents chain, state, last closed day, reconciliation checks, last run and mismatched days. It uses supplied dates and states, with labels that wrap at phone width.

Each chart has one structured tooltip with server-formatted values, dashed crosshair, markers and a date chip. Supply tooltips contain the ready tracked total, then chain levels and one-decimal ready shares, with the supplied bucket range and end-of-day, week-end or month-end wording. Flow tooltips contain the four signed flows and net, with the bucket range and sum-per-step scope. Quality notes remain visible where the data requires them.

Keyboard arrows and Home/End move the crosshair. Escape dismisses it. Touch pins the supply tooltip in a separate row above the plot, with a close button. Chart axes stay aligned when a tooltip is pinned. After hydration every native SVG title is removed and accessible chart names remain available.

Hover feedback belongs to links, buttons, chips and disclosure controls. Focus is visible. Reduced-motion preferences disable transitions and animation. Accent is reserved for active periods, links and the /// marker.

## Verification

Page tests validate block order, document-derived values, the full data date in the brand and sticky bar, null handling and quality attributes. Headless browser-smoke runs every mock state and a published-document state at 1280, 390 and 320 pixels. It checks network and console errors, local fonts, chain order and colours, disclosures, controls with and without JavaScript, tooltip uniqueness, native title removal, quality marks and sticky behavior. DOM text rectangles detect overlap and viewport overflow. Synthetic ten- and eleven-chain layouts exercise wrapping and the fallback swatch.
