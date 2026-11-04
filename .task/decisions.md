# Decisions and findings

- Preserve assigned branch `worktree-go-hometokens` and base `origin/main` (`13d57a4`) per registered worker protocol. Do not rename to the requested `tokens/home-redesign`.
- No existing token value may change. No Launch rule or page/component edit is permitted.
- Existing palette method is WCAG contrast plus CIE76 under normal vision and three Machado severity-1 simulations. Reuse its 4.5 contrast and 20 distance bars for new colours.
- All four proposed colours fail the distance threshold. Reject committing them unchanged or weakening the threshold simply to make them pass.
- Exploratory exhaustive 24-bit scan found 227,003 individually feasible colours when checking the six chain colours, five flows, four quality colours and positive/negative supply directions. Greedy nearest-first choices across all 24 slot orders did not find a mutually feasible four-colour palette. This is not proof of impossibility. Investigate feasibility before choosing replacements or requesting an owner decision.
- Mobile's generic colour and dimension conversion already includes new colours and px values. Its explicit chain list needs extending. Unitless opacity needs a named theme field.
- Plan review requested before production edits because replacement palette feasibility and selection are substantive design decisions.

# Checks so far

- `pnpm install` exit 0. No tracked lockfile change.
- First attempted harness `status` invocation exited 2 because status is a `go-worker` subcommand. Corrected `happy-harness go-worker status hometokens` exited 0 and confirmed this assigned worktree and branch.
- No production code has changed. Full checks will run after implementation.

# Plan approval follow-up and palette feasibility

- Plan round 1 was approved at `a0bdbe5`. The coordinator's follow-up was appended verbatim in a separate commit `cfcae49`.
- Confirm the eventual regression test belongs in `packages/tokens/tools/`, whose tsconfig includes Node types. It will pin the final four values, original six chain values, rounded contrasts and minimum distances, while calculating from current imported tokens.
- The exact comparison set is chain-1 through chain-6, issuer-mint, issuer-burn, bridge-in, bridge-out, net, positive, negative, delayed, unreconciled, unpaired and incomplete, plus the other three new chains. `color-shade-incomplete` uses incomplete's RGB hue at 14% opacity and is a background treatment.
- The report will identify each proposed/replacement pair with contrast against both backgrounds and the minimum distance in each of the four visions.
- Keep the stricter unrounded distance bar unless an owner decision changes it. A separate feasibility check also uses 19.95, equivalent to the existing test's round-to-one-decimal >=20 assertion for positive distances.
- The palette obstruction has a reproducible exhaustive proof in `.task/palette-search.js`. It scans every 24-bit hex colour, filters all fixed-reference constraints and both 4.5 contrast constraints, groups survivors into RGB cells of width 16, and bounds each cell's Lab coordinates using all survivors. An edge exists whenever the Lab interval upper bounds permit a passing pair in every vision. This graph overapproximates actual passing pairs. Every cell's internal upper bound is below the separation floor, so four colours require four distinct cells and a four-clique. Absence of a four-clique proves infeasibility.
- Strict >=20 scan found 227,003 survivors in 161 cells and 4,057 possible edges. No four-clique exists. Maximum within-cell upper bound in its limiting vision is 10.559974940442487.
- Round-compatible >=19.95 scan found 230,973 survivors in 162 cells and 4,111 possible edges. No four-clique exists. Maximum within-cell upper bound is 10.753881418095263.
- Excluding positive/negative produces feasible four-colour sets, but those colours occur in the quality mapping and the approved plan explicitly includes them. Reject silently dropping these references.
- A concrete fallback preserves both contrast floors at 4.5 and every normal-vision distance at 20, while relaxing only the three simulated-vision floors from 20 to 14.2 for comparisons involving a new chain. This yields four replacements closest in normal CIE76 to their proposals when selected in slot order over all 24-bit candidates passing the fallback rules. Selection is sequential, not a claim of a globally optimal four-colour assignment.
- Candidate replacements under that unapproved fallback are chain-7 `#4fb39a` -> `#229165`, chain-8 `#b08a5e` -> `#a6814a`, chain-9 `#8fb5c9` -> `#827b8a`, chain-10 `#c7a6e6` -> `#9e83fa`. Background/surface contrasts respectively are 4.988963/4.649156, 5.510125/5.134821, 4.841583/4.511814, and 6.657568/6.204110. Minimum distances against all references including the other new colours (normal/protanopia/deuteranopia/tritanopia) are respectively 31.066865/14.223320/14.243534/23.220783, 20.704264/14.223320/16.072918/16.878641, 22.263697/14.225324/14.219454/17.601533, and 20.000181/16.688167/14.496448/14.280754.
- 14.2 is near the weakest simulated separation in the repository's earlier five-chain palette, whose documented minima are 20.7/14.4/14.2. It changes the new-colour acceptance bar and therefore needs an explicit coordinator/owner decision. It is not silently adopted.
- Production implementation is pending that decision. The chosen fallback still delivers all four chain tokens and the three layout/opacity tokens. No existing token or Launch rule has changed.
- Mobile changes after palette approval will extend the explicit six-entry chain list to ten because it represents palette slots. Generic colour and px maps already convert the new colour/dimension tokens. A named unitless opacity field would expose the one new value those maps omit, as described in the approved plan. No component changes are involved.
- The first push completed successfully. PR creation is delegated to the outer driver by the registered worker instructions. Do not claim a PR exists without evidence.

# Diagnostic verification before escalation

- `node .task/palette-search.js` exit 0, reproduced the strict counts and no-four-clique result above.
- `node .task/palette-search.js --rounded` exit 0, reproduced the round-compatible counts and no-four-clique result above.
- `git ls-remote origin 'refs/pull/*/head'` exit 0. Returned only PR heads 1 and 2 at unrelated commits. No pull-request head matches the initial pushed task/plan commits, so first-push PR creation is currently unconfirmed and appears pending in the outer driver.
- No full project checks have run because production implementation is awaiting the required palette decision. `pnpm install` remains exit 0.
- Escalate without a review push. The approved plan explicitly requires an owner decision before relaxing the palette bar. Local evidence and decisions are committed for the coordinator to inspect.
