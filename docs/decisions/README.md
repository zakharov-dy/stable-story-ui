# UI decisions

The decisions of the UI track. They moved here with the UI from the repository's decision folder;
the backend decisions stay with the backend.

| № | Title | Status | In one line |
|---|---|---|---|
| [0025](0025-shared-design-tokens.md) | Shared design tokens | proposed (2026-10-29) | One portable `@app/tokens` source for web and React Native; committed generated web CSS with a drift check. |
| [0026](0026-mobile-app-stack.md) | Mobile app stack | accepted (2026-10-29) | Expo SDK 58 development builds; minimal Router skeleton now, accepted libraries assigned to later steps. |
| [0027](0027-shared-view-logic.md) | Shared view logic | accepted (2026-10-29) | Portable `@app/view` logic for web and mobile; client-owned labels, no shared components or aggregation. |

The design language is in [`../design.md`](../design.md); the testing workflow is in
[`../web-testing.md`](../web-testing.md).
