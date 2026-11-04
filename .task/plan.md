# Home redesign token plan

## Scope and baseline

- The assigned branch is `worktree-go-hometokens`, based on fresh `origin/main` at `13d57a4`. Preserve the harness-assigned branch and base despite the task's requested branch name.
- The supplied task was committed verbatim first at `0628a8e`.
- `pnpm install` completed with exit 0 and no tracked dependency changes.
- Production edits stay within the task's allowed files. Keep every existing token name and value and every Launch rule unchanged.

## Palette validation and selection

1. Reuse the mathematical method in `apps/web/src/styles/chain-palette.test.ts` in a token-package unit test, because the existing web test is outside the allowed edits. Use WCAG relative luminance and CIE76 in D65 Lab, with the same Machado severity-1 matrices in linear sRGB for protanopia, deuteranopia and tritanopia.
2. Require each new opaque colour to have unrounded contrast at least 4.5 on both `color-bg` and `color-surface`. Require unrounded distance at least 20 under normal vision and each simulation against all six original chains, all five flows, all four quality colours (delayed, unreconciled, unpaired, incomplete), and every other new chain. Include positive/negative supply-direction colours conservatively in the comparison set.
3. All four proposals fail the distance check. Their minimum distances under normal/protanopia/deuteranopia/tritanopia are respectively 23.43/6.62/12.78/14.66, 19.52/13.22/9.67/15.28, 12.30/5.39/5.83/13.55, and 16.03/7.66/4.31/6.16. Background/surface contrasts all pass.
4. Select replacement colours using normal-vision CIE76 distance to each proposal as the proximity metric. A full 24-bit scan found 227,003 colours passing the fixed-reference constraints. Simple nearest-first selection in each of the 24 slot orders produced only three mutually separated colours, so investigate a mutually feasible four-colour set before production edits. Do not reduce thresholds silently. If four slots cannot be supported, escalate the palette decision to the coordinator with computed evidence.
5. Tests must use the current imported token values for calculations, cover both backgrounds and all comparisons, and pin the chosen values and rounded computed contrasts/minimum distances. Keep the original web palette tests unchanged.

## Token, documentation and native edits

- Add chain slots 7–10 with the validated values and the exact requested `sticky-bar-height`, `opacity-dimmed` and `section-gap` strings.
- Regenerate CSS through `pnpm --filter @app/tokens generate`.
- Update only the Tokens section of `docs/design.md` with ten chain slots and the names, values and purposes of the new tokens, documenting palette replacements and their method.
- Mobile colours and px dimensions map generically. Extend the explicit `theme.chains` list to ten entries and its existing conversion test. Expose the unitless dimming opacity through the theme because it is not covered by the generic colour/px maps. Add conversion assertions for the new dimensions and opacity.

## Checks and review

- Verify programmatically against `origin/main` that every old token name and exact value survives and that the token-source diff is additive.
- Run `pnpm typecheck | tail -40`, `pnpm lint | tail -40`, `pnpm test --reporter=dot | tail -40`, then `pnpm check:build | tail -40` and `pnpm browser-smoke | tail -30` with `AI_AGENT` and `CLAUDECODE` unset. Use pipefail and record each actual exit code. Run `pnpm test:rn | tail -30` for the native theme edits.
- Before each review push, update decisions and print `git log -1 --format='%an <%ae>'`. Include the writing model's Co-Authored-By trailer. Push starts review through the driver. Do not invoke review commands.
- After final approval, remove `.task/` in a separate cleanup commit and push. Report the last code SHA, check exits, deviations, review rounds, PR status and complete verbatim verdict.
