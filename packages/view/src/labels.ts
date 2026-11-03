// Clients supply their own wording. No default texts or product name live in this package.
import type { Term } from './checks.ts';

export interface FormatLabels {
  noData: string;
  minus: string;
  plus: string;
  percent: string;
  months: readonly string[];
  utc: string;
  dayRange: (from: string, to: string) => string;
}

export interface ViewLabels extends FormatLabels {
  assetNames: Readonly<Record<string, string>>;
  na: {
    reasons: { noDataForRange: string; operationsIncomplete: string };
    history: { before: (range: string) => string; needs: (day: string, start: string) => string };
  };
  issuerVsBridge: { noFlow: { in: string; out: string } };
  tags: {
    unreconciledDay: string;
    behind: (chain: string, hours: string) => string;
    behindShort: (hours: string) => string;
  };
  resolution: {
    units: Readonly<Record<string, string>>;
    flagged: string;
    partial: string;
    levelEnd: (step: string) => string;
    flowSum: (step: string, scope: string) => string;
  };
  supplyByChain: {
    gapNote: (range: string) => string;
    shareTotal: string;
    endOfDay: string;
  };
  header: { cards: { supply: string } };
  flows: Readonly<Record<Term, string>>;
  drivers: { gapNote: (range: string) => string; allChains: string };
}
