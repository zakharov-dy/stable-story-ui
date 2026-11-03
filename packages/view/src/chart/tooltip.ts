// Structured tooltip content of a chart column. Every string is formatted on the server; the client
// component only places the card. A chart without structured data keeps the plain-string tooltip.

/** The marker before a row or a header: a chain dot, a flow square, or nothing. */
export type TooltipMarker = 'dot' | 'solid-square' | 'hatched-square' | 'bar' | 'none';

export interface TooltipRow {
  label: string;
  value: string; // already formatted (compact level, exact amount, …)
  share?: string; // already formatted share with its unit, e.g. "80.0%"
  chain?: number; // data-chain-index: the --chain-color slot of the row dot
  marker?: TooltipMarker; // absent is the chain dot, so supply-by-chain rows read as today
  flow?: string; // data-flow: colours a flow marker (issuer/bridge/net), e.g. "issuer_mint"
}

export interface TooltipNote {
  text: string; // the card's wording; a delayed chain is named here, so the chain is unambiguous
  /** The no-JS title's wording, where the rows already name the chain; defaults to `text`. */
  title?: string;
  tone: 'incomplete' | 'unreconciled' | 'delayed';
}

export interface TooltipColumn {
  header: { label: string; value?: string; share?: string; marker?: TooltipMarker }; // value absent (a flow card names only its chain); 'none' hides the line
  rows: readonly TooltipRow[];
  note?: TooltipNote;
  footer: { label: string; value: string };
  splitBefore?: number; // a hairline is drawn before this row index; absent is no hairline
  hideHeader?: boolean; // drivers put their scope in the footer
}

/** Ready plot coordinates, without any data calculations in the client. */
export interface ChartMarker {
  at: number;
  chain?: number;
  flow?: 'net';
}
