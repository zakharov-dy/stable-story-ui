# Mobile development client

Use the Expo SDK 58 development build, not Expo Go. Install Xcode with its
command-line tools and an iOS Simulator runtime; native builds also need CocoaPods.
The normal route is a plain-text data probe. Product screens await design.

From the repository root:

```bash
pnpm install
xcrun simctl list devices available
# Use a simulator name or UUID from the list:
pnpm --filter @app/mobile ios --device 'iPhone 17 Pro'
```

The last command generates `ios/`, builds and installs the development client,
starts Metro and opens the app. On subsequent runs with that client installed:

```bash
pnpm --filter @app/mobile start --ios
```

## Data probe and agent tools (development only)

`app.config.ts` reads `API_MODE=mock|live` and `API_URL` into public
`extra.API_MODE` / `extra.API_URL`; the app reads `Constants.expoConfig.extra`.
These are the same environment names as web, without EXPO_PUBLIC aliases.
They are public configuration, never credentials. Restart Metro after changes.
`API_MODE` defaults to `live`. In development an omitted URL uses
`http://127.0.0.1:3000` on iOS or `http://10.0.2.2:3000` on Android. Release
requires an explicit HTTP(S) URL without credentials, query or fragment;
inherited mock mode produces a diagnostic and resolves to live.

The app calls only `ApiClient.overview({ asset: 'usdc' })`. Query keys live in
`src/data/keys.ts`; policy lives in `src/data/policy.ts`: no automatic retries,
polling, focus/reconnect or mount refetch. The unmodified DTO stays cached for the
provider's lifetime; Retry and pull-to-refresh explicitly refetch. An error,
including a failed refresh, shows unavailable; only successful `asOf: null` is
empty. Offline persistence can wrap the QueryClient boundary later.

Start Metro against mocks, then open the installed client:

```bash
API_MODE=mock EXPO_NO_TELEMETRY=1 pnpm --filter @app/mobile start --localhost
```

Expo SDK 58's `EXPO_UNSTABLE_MCP_SERVER=1` on **Metro** selects the hosted
`mcp.expo.dev` tunnel. For a local-only MCP connection, start the pinned provider
as a stdio process in your MCP client (the flag is harmless on this provider;
it does not request a tunnel):

```bash
EXPO_UNSTABLE_MCP_SERVER=1 pnpm --filter @app/mobile exec expo-mcp --dev-server-url http://127.0.0.1:8081
```

`expo-mcp` and `agent-device` are pinned dev dependencies and never imported by
the app. The SDK range for expo-mcp is `~0.2.1`; the installed exact pin is 0.2.4.
Use stdio MCP tools for local Metro diagnostics; agent-device reads the native
accessibility tree. No hosted MCP tunnel is needed for this workflow.

Mock mode starts at `ok`; `MOCK_STATE` is not supported. Select all nine contract
states (`ok`, `delayed`, `unreconciled`, `empty-day`, `short-history`, `gap`,
`empty`, `long-history`, `unavailable`) or `live` through the development menu's
**Select API scenario** item, or a cold/warm link:

```bash
xcrun simctl openurl <SIMULATOR_UUID> stablestory://dev/scenario/empty
xcrun simctl openurl <SIMULATOR_UUID> stablestory://dev/scenario/unavailable
xcrun simctl openurl <SIMULATOR_UUID> stablestory://dev/scenario/ok
```

The exact form is `stablestory://dev/scenario/<name>`: `dev` is the host.
Other schemes/hosts, malformed links and unknown names pass through unchanged.
Each selection cancels old requests and resets Query cache, including repeated
links to the same state. `delayed` means the contract's Base-lags-a-day data;
it is not a slow network simulation. `loading` is the pending query state.
On a cold development-client launch, Expo may show its launcher first: select
the recent `http://127.0.0.1:8081` server to load the project. Expo retains the
pending scenario link and delivers it to Router's initial-URL handler.

Native controls use `<screen>.<element>` testIDs plus explicit roles/labels:
`overview.retry`, `overview.refresh`, `overview.scenario-<name>` and
`overview.scenario-close`. Read-only text uses `overview.state`,
`overview.as-of`, `overview.chains`, `overview.history-start`, `overview.name`.

```bash
pnpm --filter @app/mobile exec agent-device open stablestory.mobile --platform ios --udid <SIMULATOR_UUID>
pnpm --filter @app/mobile exec agent-device doctor
pnpm --filter @app/mobile exec agent-device snapshot -i
```

Read Metro's terminal for one JSON line per overview result and scenario change:
`{"evt":"api.request","path":"/v1/supply/overview","ms":120,"status":200}`.
Failures include ApiError `kind`, `status`, `code`; transport status/code are
null. Codes outside the known API machine-code allowlist become `unknown`.
URLs, payloads, error messages/causes and arbitrary fields are omitted.
You can also collect local native/Metro logs:

```bash
pnpm --filter @app/mobile exec expo-mcp --dev-server-url http://127.0.0.1:8081 --app-id stablestory.mobile --platform ios --collect-logs 5000
pnpm --filter @app/mobile exec agent-device close
xcrun simctl shutdown <SIMULATOR_UUID>
```

The optional collector can return no JavaScript lines when this SDK's CDP
connection fails; the same JSON events remain readable in Metro's terminal.

Stop Metro with Ctrl-C after checks. The development scenario modal/menu,
scenario link handler and JSON logger are excluded by production Metro resolver
stubs. SDK graph optimization/tree shaking removes the contracts barrel's unused
mock implementation and fixtures; both flags are enforced in metro.config.js
for ordinary Release builds as well as release checks. Identity/no-op production
stubs live under `src/data/production/`, outside the excluded `src/data/dev/`.

## Component catalog

Stop any existing mobile Metro process, then open Storybook in the installed client:

```bash
pnpm --filter @app/mobile storybook --ios
```

Select Primitives / Text or Surface, or Theme / Tokens / Colours or Typography.
The catalog shares the converted phone theme and bundled fonts with the app.
It is enabled only in development when `EXPO_PUBLIC_STORYBOOK_ENABLED=true`.
The script sets that toggle; ordinary `start` opens the app. Restart Metro when
switching. Production disables the catalog even if the toggle is inherited.
Storybook telemetry and MCP are disabled.

Story files live beside their components (`*.stories.tsx`). The registration file
`.rnstorybook/storybook.requires.js` is committed. Metro refreshes it when starting
the catalog. After adding or moving stories, regenerate and commit it:

```bash
pnpm --filter @app/mobile storybook:generate
```

Storybook's SVG and bottom-sheet peers are development dependencies for its catalog
UI only. They introduce no product chart or sheet components.

Rebuild with `ios` after changing native dependencies or app configuration.
Generated `ios/`, `android/` and `.expo/` folders are ignored and never committed.
To assemble the Android debug development client without running an emulator:

```bash
cd apps/mobile
npx expo prebuild --platform android
cd android
ANDROID_HOME="${ANDROID_HOME}" \
JAVA_HOME="${JAVA_HOME}" \
./gradlew :app:assembleDebug -Pandroid.builder.sdkDownload=false
```

Set `ANDROID_HOME` and `JAVA_HOME` to existing Android SDK and JDK installations.
SDK 58 requires Android platform 37 and build-tools 37.0.0. The flag prevents
automatic SDK installation. A successful build produces
`android/app/build/outputs/apk/debug/app-debug.apk` (relative to `apps/mobile`).
The command builds only; it does not start a device. Android assembly remains
outside this iOS UI-base task.

## Tests

```bash
pnpm typecheck
pnpm lint
pnpm test --reporter=dot
pnpm --filter @app/mobile test:rn
```

Vitest owns pure conversion/data tests (`*.test.ts`). Jest Expo owns native render tests
(`src/**/*.test.tsx`), including the real workspace token adapter; discovery never
overlaps. Jest uses filesystem crawling rather than requiring system Watchman.

All product colors, font families, dimensions and palette slots come from
`@app/tokens`, with `phoneTokens` overrides converted in `src/theme`. Text exposes
the token type scale and sans/mono families; Surface exposes existing backgrounds
and radii. Native props, including accessibility props and `testID`, pass through.
No font-weight or line-height values are invented; the bundled fonts stay regular.

Verify the release boundary with `pnpm --filter @app/mobile check:release`. It
clears old output and exports production iOS JavaScript using both `expo export`
and Xcode's `expo export:embed --dev false` path, with mock/catalog settings
inherited and incoming optimization flags set to zero. It inspects all source-map
sections and emitted code for Storybook, mocks/fixtures, development scenario
modules, logging and agent tools. The output stays in ignored `.expo/release-check`.
`babel.config.js` uses Expo's bundled preset and a local adapter: Metro drops
Node-only JSON import attributes, and Jest transforms dynamic imports to async
CommonJS loads. Contracts and fixture data are unchanged.
