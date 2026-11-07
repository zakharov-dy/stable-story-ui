# Decisions — web/site-icon

- `icon.svg`: recompared the worktree file with the task literal byte for byte
  (`cmp`); it differed only by a trailing newline, so rewrote the file with
  `printf '%s'` — now `cmp` reports byte-equal (349 bytes, no trailing newline).
- `apple-icon.png`: re-rendered from the `apple-touch-icon-180.svg` literal
  myself (no reliance on the pre-existing PNG's provenance) with `sharp` run
  ad hoc from `$TMPDIR/raster` (outside the repo). Render at density 300,
  resized to 180×180, `removeAlpha()` → 180×180 RGB PNG, no alpha.
  Verified pixel colours: corners `#13112a`, stroke `#b69aff` (left/top edges),
  fill `#b69aff`, interior hole and surround `#13112a`.
- Rasteriser choice: Homebrew `rsvg-convert` exists but is broken in this
  environment (dyld: `libgio-2.0.0.dylib` missing after a glib upgrade), so
  used the pre-allowed exception and fetched `sharp` via npm into `$TMPDIR`
  only. Nothing added to the workspace: `package.json` / `pnpm-lock.yaml`
  untouched, no SVG sources added to the app.
- Rejected: `sips`/`qlmanage` (no faithful SVG rasterisation), `cairosvg`
  (not installed; would need system libs), fixing Homebrew (heavier than the
  one-off npm fetch the task pre-allows).
- No test pins the old icon bytes (`pnpm test` green, 1360 passed); no test
  touched. `docs/architecture.md`: no deviations (asset-only change).
