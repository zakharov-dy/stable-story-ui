# Reconciliation summary decisions

## Plan round

- Supplied task committed verbatim before planning in 78e9d5a, including the review header.
- Fresh remote main matches the assigned root base 7d00d0a. Initialized ui at its current main 13d57a4 and created its contract/recon-summary branch. Root local and remote review branch are worktree-go-reconsummary under the harness assignment and coordinator clarification of 2026-11-04. All later root pushes use that same-name remote branch so the review hook detects them.
- Root and UI pnpm install --frozen-lockfile both exited 0. No lockfile changes.
- Read root and UI CLAUDE.md, ancestor AGENTS.md, architecture 3.4/3.6 and relevant section 5, ADRs 0023/0028, publisher snapshot/parity tests and current overview loading/computation.
- The handoff source is absent from this backend checkout. Read only requested sections 7 and 10–11 and the stamp line of section 2 from the artifacts checkout at /Users/dmitry/dev/block-and-tell-artifacts/handoff/web/fable-answer-2026-11-04.md. No artifact edits.
- Reuse in-memory DayTable and day_flow.events. Rejected counting raw event rows because it would scan large history unnecessarily. No database schema or index is needed.
- Whole retained-history totals are separate from the common-date streak. Rejected min(per-chain latest suffix) because chains can close through different endpoints. Gaps terminate both suffix definitions.
- Proposed strict reconciledChains counts latest supply/bridge/continuity all ok, independently of freshness state. Continuity none is mismatch-free but does not meet that separate all-checks-ok definition.
- UI/root drafts contain only temporary task files during plan review. Implementation, performance measurements and full checks await plan approval as required by the worker protocol.
- The installed CLI has no top-level status command. Its supported go-worker status reconsummary confirmed this worker's assigned checkout/model. No review command was run.
- UI draft PR https://github.com/zakharov-dy/stable-story-ui/pull/2 targets main from contract/recon-summary. Root PR https://github.com/zakharov-dy/block-and-tell/pull/209 targets main from worktree-go-reconsummary. The coordinator confirmed that root PR #208 is closed and the obsolete remote root contract/recon-summary branch is deleted. The original root push to contract/recon-summary started no review round. The same-name root push starts the plan round after this turn ends. Review the UI branch directly with git -C ui diff origin/main...contract/recon-summary during this task-files-only round. Root's unstaged ui change reflects the UI branch commits, and its gitlink intentionally stays at main until implementation review.
- Following the usage-limit interruption, checked both branches and synchronized this decisions record in both repositories. Only task records were updated. Both branches are pushed before yielding for plan review, with the UI branch and PR retained.
- Plan-round validation ran git diff --check in both repositories with exit 0. Full code gates and live cold timing are pending implementation. There is no reviewer verdict yet, and no code has been changed.
