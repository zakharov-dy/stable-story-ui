# 26. Mobile app stack

- Status: Accepted (owner, 2026-10-29). The merge records the accepted stack.

## Context

Stable Story will have a React Native app after the web launch. Preparing its
build-and-start skeleton now must not expand the web launch criteria. The owner
selected Expo and the libraries below on 2026-10-29; subsequent tasks implement
these choices rather than select a stack again. Components remain separate from
web; API contracts and design tokens are shared ([ADR 0025](0025-shared-design-tokens.md)).

## Decision

Use Expo SDK 58 with development builds (`expo-dev-client`), never Expo Go.
`apps/mobile` is `@app/mobile`; its only workspace dependencies are `@app/contracts`
and `@app/tokens`. Keep the repository's TypeScript 6, strict and erasable syntax,
explicit relative TypeScript extensions and type-only imports. Native dependencies
are installed with `npx expo install` using SDK pins.

The accepted library list is one table. Now means this build-and-start skeleton;
later means the named implementation step, with no dependency added prematurely.
Exact installed versions for the current step are recorded below.

| Library | Installed version now | Step / purpose |
|---|---|---|
| `expo` | 58.0.21 | Now: SDK and native build tooling |
| `react-native` | 0.88.1 | Now: native runtime |
| `react` | 19.3.0 | Now: same version as web |
| `expo-router` | 58.0.28 | Now: file routes and URL parameters |
| `react-native-screens` | 4.30.0 | Now: required Router native peer |
| `react-native-safe-area-context` | 5.10.1 | Now: safe areas and required Router peer |
| `expo-linking` | 58.0.15 | Now: required Router peer, deep links |
| `expo-constants` | 58.0.14 | Now: required Router peer, resolved config |
| `expo-status-bar` | 58.0.4 | Now: status bar |
| `expo-splash-screen` | 58.0.12 | Now: keep splash until fonts load |
| `expo-font` | 58.0.11 | Now: bundled fonts |
| `@expo-google-fonts/space-grotesk` | 0.4.1 | Now: web's sans family |
| `@expo-google-fonts/ibm-plex-mono` | 0.4.1 | Now: web's mono family |
| `expo-dev-client` | 58.0.17 | Now: development builds |
| `eslint-config-expo` | 58.0.4 | Now, development only: native lint configuration |
| `@eslint/compat` | 2.1.1 | Now, development only: adapt Expo's legacy plugin rule-context APIs to repository ESLint 10 without disabling rules |
| `@expo/log-box`, `@expo/metro-runtime` | 58.0.13, 58.0.15 | Now, transitive: Router's mandatory peers, also its dependencies; development errors and Metro runtime |
| `react-native-reanimated` | 4.7.1 | Now: mandatory peer of Router's `react-native-drawer-layout` dependency; animation features remain later |
| `react-native-worklets` | 0.13.0 | Now: mandatory peer of Reanimated; SDK's exact pin |
| `react-native-gesture-handler` | 3.3.0 | Now: mandatory peer of Router's drawer dependency; gesture features remain later |
| `expo-glass-effect`, `@react-native-masked-view/masked-view` | 58.0.5, 0.3.2 | Now, transitive: native dependencies required by Router; no glass/mask UI added |
| `@tanstack/react-query` | — | Later: first server-data screens, over `ApiClient` |
| `expo-system-ui` | — | Later: system appearance work |
| `expo-mcp`, `agent-device` | — | Later: next agent debugging step |
| Storybook | — | Later: component catalog after token primitives |
| `jest-expo`, `@testing-library/react-native` | — | Later: first React Native component tests |
| `@shopify/react-native-skia` and chart code | — | Later: native charts |
| Firebase and App Check | — | Later: mobile delivery path (Cloudflare Worker verifies App Check; the publication decision); no dependency in the skeleton |
| Offline persistence | — | Foreseen, not built; implement when offline requirements arrive |
| Zustand | — | Later: first shared client state, only when needed |
| Bottom sheet, haptics, icons | — | Later: first interaction that needs each; no package choice added here |

React types and TypeScript are development dependencies matching React 19.3 and
the repository's TypeScript 6. Router's optional web and testing peers do not
justify adding web support or a native test runner in this step.

Although Router marks animation and gesture peers optional, its non-optional
`react-native-drawer-layout` 4.2.12 dependency requires gesture-handler and
Reanimated, and Reanimated requires Worklets. They are installed now solely for
that dependency chain, using SDK 58 pins rather than pnpm's newer automatic peer
resolutions. The placeholder implements no drawer, gestures or animation.

### Data and state

Server data will use TanStack Query over the shared `ApiClient` in the first data
screens. User choices belong in `expo-router` URL parameters. There is no client
store until shared client state requires one; then use Zustand. Offline
persistence is a future requirement, not a skeleton feature. The publication decision supersedes backend delivery; mobile reads the same published overview through the Cloudflare Worker App Check path. Local HTTP and mock modes remain development tools.

The public view policy applies unchanged: the server
selects the window, computes steps and serves only the page's detail. Mobile
renders the response, never aggregates it or receives more than the page.

### Identity

The iOS bundle identifier and Android package are `stablestory.mobile`; the slug
and deep-link scheme are `stablestory`. The display name is a single working-name
constant in `app.config.ts`, matching `apps/web/src/texts.ts` without importing
web-only code. The placeholder reads the resolved config name, with a neutral
deterministic fallback. Identifiers contain no other product text.

An identifier becomes fixed at the first store upload: TestFlight and Play
internal testing count. Before that upload it may change, for example to a reverse
domain once one is bought. After it, never change the identifier.

### Testing and agent debugging

Vitest owns plain TypeScript tests named `*.test.ts` (integration tests remain
`*.int.test.ts`). Future jest-expo owns React Native component tests named
`*.test.tsx`, with its discovery restricted to that suffix. Vitest's existing
include does not match those files, so the runners never pick the same test.
There is no native component runner in the skeleton. The name-only placeholder
adds no unit test of React Native or the standard library's px-number parsing.

The intended next debugging step uses stable `testID`s in `<screen>.<element>`
form, development scenarios from `@app/contracts` mock states (`createMockClient`,
`MockState`), JSON-line logs, `expo-mcp` and `agent-device`. The mock states include
ok, delayed, unreconciled, empty-day, short-history, gap, empty, long-history and
unavailable. Scenario switching, logging and agent tools are not built here.

## Consequences

The app can be built and started independently of web. Its placeholder has safe
areas, splash handling and bundled Space Grotesk / IBM Plex Mono. Native colors
use the token strings directly where compatible, and CSS px dimensions become
numeric logical pixels; no token values are copied and no primitives are added.
Generated native projects are ignored and regenerated from Expo config.

A development build was verified in the iOS Simulator for this change;
simulator smoke is not a repository gate. Android config and prebuild are verified;
the Android debug build is not verified because SDK 37 is missing. The owner
installs it separately; Android assembly is outside this PR (owner addition 2,
2026-10-29), with no emulator/device run. Mobile has no launch criteria and adds
no web launch check. The change merges after review
approval and the local gate.

## Rejected

- Expo Go: the accepted development workflow uses development builds.
- Product screens, charts, network requests, a token primitive layer, Storybook,
  agent tooling and client stores in the skeleton: each belongs to its later step.
- Copying tokens or sharing web components: only contracts and tokens cross the
  workspace boundary; native consumers adapt the source constants.
- Redux/RTK/saga/persist, axios, react-hook-form/yup, moment/lodash/bignumber,
  Reactotron, `react-native-svg-transformer`, `babel-plugin-module-resolver`,
  prettier/husky/knip and i18n libraries: excluded by the owner's accepted list.

## UI base follow-up (M5, 2026-10-29)

The table above records the original skeleton. Its deferred Storybook and native
testing steps are now implemented: `@storybook/react-native` 10.7.0, `storybook`
10.6.5, SDK-pinned `jest-expo` 58.0.13, `@react-native/jest-preset` 0.88.1, Jest
30.5.2 and `@testing-library/react-native` 14.1.0 (its required `test-renderer`
1.3.0 peer). Jest globals/types are development-only test support. Native tests
use only `*.test.tsx`; pure token conversions remain Vitest `*.test.ts`.

Storybook's on-device UI requires SDK-pinned `react-native-svg` 15.16.0 and
`@gorhom/bottom-sheet` 5.2.14 as development-only dependencies (clarified
2026-10-29). These are Storybook-only: product charts remain on
Skia, and product bottom sheets remain deferred. The entry requires both
`__DEV__` and the explicit catalog environment toggle; Metro also disables and
strips Storybook in production even if the toggle is inherited. Catalog files
stay outside Router routes. Generated registration is committed and regenerated
by script and catalog startup. Telemetry and MCP are disabled.

The theme converts shared tokens with phone overrides, and registers the existing
regular bundled assets under names parsed from the font tokens. Text and Surface
introduce no typography/surface values; font failure displays an accessible native
fallback message. No Screen primitive is needed yet. The historical skeleton-only
native-test wording in the repository guidance is superseded by this note.

## Data and agent follow-up (M6, 2026-10-29)

TanStack Query 5.105.0 now caches the unmodified overview DTO; only `overview`
is called. Keys are `['overview', asset]`. Policy is explicit refetch: no automatic
retries, polling, mount/focus/reconnect refetch; Retry and pull-to-refresh request
again. Cache lasts until the provider is disposed or a scenario resets it.
All ApiError kinds show unavailable, including a failed refresh; only successful
`asOf: null` shows empty. Persistence remains one future provider wrapper.

The current HTTP development transport below is not a production connection to the analytical backend; production follows the publication decision.

Expo public `extra.API_MODE` / `extra.API_URL` come from the same unprefixed
environment names as web. Live is default; development URLs default to iOS
127.0.0.1:3000 / Android 10.0.2.2:3000. Release requires explicit API_URL and
forces live with a diagnostic if mock mode is inherited. Development mock starts
at ok; MOCK_STATE is unsupported. The scenario link form is
`stablestory://dev/scenario/<name>` for every contract mock state or live. Cold
and warm selections reset Query cache; the dev-menu item opens a plain-text
cross-platform modal with the same choices.

`expo-mcp` 0.2.4 (SDK's ~0.2.1 range) and `agent-device` 0.21.34 are pinned dev
dependencies. Local stdio Expo MCP avoids SDK 58's hosted tunnel selected by
EXPO_UNSTABLE_MCP_SERVER=1 on Metro. Native accessibility snapshots and redacted
JSON result/error logs support the probe workflow. Production Metro substitutes
identity/no-op modules for scenario entries and enables SDK graph optimization
and tree shaking to exclude unused contracts mocks. Release checks inspect both
export and native export:embed artifacts. Mobile Babel adapts Node JSON import
attributes for Metro and asynchronous imports for Jest without changing contracts.
