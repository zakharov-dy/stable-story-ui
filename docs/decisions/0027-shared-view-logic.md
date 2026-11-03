# 27. Shared view logic

- Status: Accepted (2026-10-29). The owner decided on this date; the merge records the decision.

## Context

The web page already has pure TypeScript that turns an `Overview` response into display values: exact amount and UTC date formatting, quality flags, the day equation, period selection, series, chart scales and tooltips. The React Native screens will need the same logic. Copying it into mobile would create two independently editable implementations of the same display rules.

## Decision

Add `packages/view` (`@app/view`) as the shared source of pure view logic for web and mobile. Like `@app/tokens`, it exports TypeScript sources with no package build step. Its exact root export points to `./src/index.ts`. Web and mobile may import `contracts`, `tokens` and `view`; view may import only `@app/contracts` from the workspace. Its production contracts imports are type-only, so no contracts or zod runtime enters the package.

View contains no components, React, UI texts or product name. Each client owns those: the web keeps its existing `apps/web/src/texts.ts`. Typed labels and callbacks are supplied to factory functions, with no default wording or global configuration. The web's small binding module initializes these functions from its texts; it contains no view algorithms. Clients keep separate components.

View uses ES APIs and `Intl` only, with no Node or DOM APIs or Node types. Its tsconfig uses `types: []` and ES2023 + DOM declarations because TypeScript also checks the source-exported contracts HTTP client, even through type-only imports. DOM declarations do not authorize DOM use in view: a narrow ESLint guard restricts platform imports and globals, and source review checks remaining qualified access and platform type references.

View never aggregates data or builds buckets. It selects and formats the API's declared views, periods, totals, stack boundaries and shares; it never sums chain levels or recreates server metrics. Existing exact within-bucket arithmetic for diagram coordinates and display signs stays unchanged. Amounts remain decimal strings and bigint, with numbers used for counters and coordinates.

Move the reusable web implementations with their independent unit suites. Tests that require the web's exact wording or web-only rendering fixtures stay in web as consumer tests, with their assertions unchanged. HTML checks and test-support helpers remain web-only. This extraction changes no rendered values, labels, layout or interactions. Mobile declares the dependency when screens first use it; this decision adds no mobile code or launch criterion.

## Consequences

Web and mobile use one implementation of display calculations while keeping their own wording and UI. New shared functions must remain portable and respect the server's public-view policy. Web build, HTML/leak checks and browser smoke continue to verify the existing page; independent tests follow the shared code, and web consumer tests verify label binding.

## Rejected

- Copying web logic into mobile: the two implementations would drift.
- Importing web texts or providing default English labels in view: wording and the product name belong to each client.
- Sharing web and native components: the owner chose separate component implementations.
- ES-only compilation while importing the contracts source export: its transitive HTTP client needs DOM declarations to typecheck. Changing contracts or introducing substitute ambient declarations is unnecessary for this move.
- Client aggregation or bucket construction: it would duplicate the server's public view policy.
