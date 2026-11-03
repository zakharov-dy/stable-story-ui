# 25. Shared design tokens

- Status: Proposed (2026-10-29). The owner accepts this ADR by merging it.

## Context

Stable Story's web launch precedes the React Native app. The owner decided on 2026-10-28 that both apps use one repository source of design tokens, without sharing components. Copying web tokens into the future mobile app would give the same design two independently editable sources. The design-system artifact is rebuilt from repository tokens; it is not their source of truth.

## Decision

Add the workspace package `packages/tokens` (`@app/tokens`). Its one source of values is `src/tokens.ts`: typed readonly constants for every existing web token, the phone overrides and their breakpoint. Export TypeScript sources through `exports` → `./src/*.ts`, with no package build step, as for the other packages.

The workspace boundary is `apps/web, apps/mobile → contracts, tokens`. `@app/tokens` production sources import nothing from the workspace, have no dependencies or `@types/node`, and use neither DOM-only nor Node-only APIs. They compile with ES libraries and `types: []`, and run in web and React Native. Node tooling lives outside the exported production sources and is typechecked separately. The existing test-only fixture exception remains unchanged.

A small plain TypeScript script run directly by Node generates and commits `apps/web/src/styles/tokens.css`. Run `pnpm --filter @app/tokens generate` after editing the source. The generated header names its source and command; the existing custom-property names and responsive behavior remain unchanged. Web keeps importing this file in its root layout and needs no TypeScript dependency on tokens while it consumes only the generated CSS. A read-only unit test compares the committed file byte for byte with current generator output and fails on drift.

Values retain their exact CSS strings, including units, aliases and font stacks. Mobile consumers adapt these constants to native styles, for example `'12px'` to `12`, resolving aliases and choosing native fonts as appropriate. This extraction adds no RN code or component sharing. All six chain colours, including `#e06c77`, and all other token values stay unchanged.

A token change is a token PR: edit the repository source, regenerate the committed CSS, and rebuild the Design System artifact from those tokens. No separate copy of token values lives in `apps/mobile`.

## Consequences

Web and mobile have a single typed source of design values with independent component implementations. The web build consumes a reviewed CSS artifact without a new generation step or dependency. Contributors must regenerate it when tokens change; the existing unit gate detects omissions. Native styling still needs platform adaptation of units and CSS-specific values. Mobile remains outside the web launch criteria; this ADR creates no mobile app.

## Rejected

- A token copy inside `apps/mobile`: it would drift from the repository source.
- DTCG or Style Dictionary: a schema and dependency stack are unnecessary for this small set of constants and one CSS output.
- Generation only at build time: keeping the generated CSS committed makes the exact web artifact reviewable and lets the existing build consume it directly; the drift check verifies it before merging.
- Sharing web and native components: the owner chose shared tokens and API contracts with separate UI implementations.
