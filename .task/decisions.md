# Decisions — smoke/harness-check (test task, PR will be closed unmerged)

- Stayed on assigned branch `worktree-go-uismoke` instead of creating `smoke/harness-check`:
  harness instruction "Preserve your assigned branch/base" takes precedence over the task text.
- Changed only `README.md` (one appended line `Harness check.`); no product code touched.
- Skipped `pnpm check:build` and `pnpm browser-smoke` per task step 2 (no `apps/web` changes).
- Note: this shell has no `PIPESTATUS` for piped exit codes, so gate commands were run with
  output redirected to `$TMPDIR` log files and the real exit code captured via `$?`.
- Pipe form from the task was also attempted for typecheck; output was clean, exit confirmed
  as 0 via the log-file rerun.
