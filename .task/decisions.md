# Decisions: tokens for the mobile app screens

- No plan.md: the change is eight additive tokens plus a generic converter
  extension; nothing architectural to approve first.
- `px` tokens needed no converter change: `theme.dimensions` already maps every
  `*px` token generically via the `PxToken` template type, so the seven px
  tokens flow through automatically (covered by direct-value assertions).
- `skeleton-pulse` (1600ms) needed a typed path: nothing mapped `*ms` tokens,
  so the value would have been invisible to native code. Added a generic `ms()`
  converter (same strict shape as `px()`, rejects `s`/`em`/unitless) and a
  generic `theme.durations` record covering all `*ms` tokens, including the
  existing motion tokens. Rejected alternative: leaving `ms` unmapped and
  letting screens parse `tokens` raw, which would bypass the unit checking the
  theme layer exists for.
- Test asserts exact converted numbers for all eight tokens plus rejection of
  `1.6s`, so it cannot pass with a dropped or mis-scaled unit.
- No existing token name or value touched; `phoneTokens` untouched.
