# Decisions log

## Plan round (2026-11-07)

- Period display order is a web-local `PERIOD_ORDER = ['all','90d','30d']`; `PERIODS` in
  packages/view stays untouched (packages/view is out of scope and shared with mobile).
- The brand row gets a single link slot: delayed notes replace the reconciled tally when chains are
  delayed, per `Home-1107-state-delayed-1280`; unreconciled keeps the tally with ◇.
- The phone Status section renders the board's `ul.status-list` alongside the desktop table (CSS
  chooses); both are server HTML, no JavaScript. Chain-state carriers stay 3 per chain
  (chain list, desktop table, phone list).
- Waterfall keeps the existing symmetric y-scale (zero at mid-height); only x-geometry moves to the
  board's 560/112/48 grid. Zero-line and connector stroke colours stay as built (tokens unchanged;
  board styling of these hairlines is not part of the five changes).
- The date and the reconciliation link are separate elements in the brand row (visually
  `date · link` as on the boards) so `data-date="brand"` keeps carrying exactly the full data date.
