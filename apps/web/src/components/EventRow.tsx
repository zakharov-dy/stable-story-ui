import type { EventRow } from '@app/contracts';
import { formatAmount, formatTime } from '../view.ts';
import { texts } from '../texts.ts';
import { chainInfo, type Chains, MAGNITUDE_STEPS, magnitudeStep } from '@app/view';

/** An amount with its fractional part dimmed (the design's `.frac`); string work only. */
export function AmountDigits({ value }: { value: string }) {
  const text = formatAmount(value);
  const point = text.indexOf('.');
  return point === -1 ? <>{text}</> : <>{text.slice(0, point)}<span className="frac">{text.slice(point)}</span></>;
}

/** The six-step order-of-magnitude marker; the step comes from the digit count of the amount. */
export function Magnitude({ amount }: { amount: string }) {
  const step = magnitudeStep(amount);
  const label = texts.feed.magnitude[step - 1] ?? '';
  return (
    <>
      <span className="mag" role="img" aria-label={texts.feed.magnitudeAria(label)} data-step={step}>
        {Array.from({ length: MAGNITUDE_STEPS }, (_, index) => <i key={index} className={index < step ? 'on' : undefined} />)}
      </span>
      <span className="amt-text"><AmountDigits value={amount} /></span>
      <span className="magt">{label}</span>
    </>
  );
}

/** "issuer mint", or "bridge in from Base" with the peer as plain text; a missing peer is only a tag. */
export function eventType(row: EventRow): string {
  const type = texts.feed.types[row.flow];
  const peer = row.bridge?.peer ?? null;
  if (peer === null) return type;
  return `${type} ${row.flow === 'bridge_in' ? texts.feed.bridgeFrom(peer.name) : texts.feed.bridgeTo(peer.name)}`;
}

/**
 * Row attributes: the flow and the unpaired / unreconciled marks (present only when true). A record
 * card shows the event in a table of its own, which must not count as a feed row.
 */
export function eventAttributes(row: EventRow, variant: 'feed' | 'record') {
  return {
    [variant === 'feed' ? 'data-flow' : 'data-event-flow']: row.flow,
    'data-unpaired': row.unpaired ? 'true' : undefined,
    'data-unreconciled': row.unreconciled ? 'true' : undefined,
  };
}

/** Tags under the type: CCTP version, unpaired, unknown peer, unreconciled day. `data-mark` only in the feed. */
function Route({ row, variant }: { row: EventRow; variant: 'feed' | 'record' }) {
  const mark = (name: string) => (variant === 'feed' ? name : undefined);
  const noPeer = row.bridge !== null && row.bridge.peer === null;
  return (
    <span className="route">
      {row.bridge === null ? texts.feed.outsideCctp : <span className="tag cctp">{texts.feed.cctp(row.bridge.version)}</span>}
      {row.unpaired ? <span className="tag unpaired" data-mark={mark('unpaired')}>{texts.tags.unpaired}</span> : null}
      {noPeer ? <span className="tag peer">{texts.tags.peerUnknown}</span> : null}
      {row.unreconciled ? <span className="tag unrec" data-mark={mark('unreconciled')}>{texts.tags.unreconciledDay}</span> : null}
    </span>
  );
}

/** One event as a table row: amount with its marker, chain, type with route tags, UTC time, explorer link. */
export function EventTableRow({ row, chains, variant }: { row: EventRow; chains: Chains; variant: 'feed' | 'record' }) {
  const chain = chainInfo(chains, row.chain);
  return (
    <tr {...eventAttributes(row, variant)} role="row">
      <td role="cell" className="amt"><Magnitude amount={row.amount} /></td>
      <td role="cell" className="fch"><span className="chain" data-chain-index={chain.index}>{chain.name}</span></td>
      <td role="cell" className="ftype">
        <span className="t"><span className="sw" data-flow={row.flow} />{eventType(row)}</span>
        <Route row={row} variant={variant} />
      </td>
      <td role="cell" className="ftime">{formatTime(row.time)}</td>
      <td role="cell" className="ftx"><a href={row.explorerUrl} rel="noopener noreferrer">{texts.feed.explorer}</a></td>
    </tr>
  );
}

/**
 * The events as a table. The elements stay `table`, `tr`, `th`, `td`; narrow containers restyle them
 * as cards, which drops the native table semantics in some browsers, so the roles are explicit.
 */
export function EventsTable({ rows, chains, variant, labelledBy }: { rows: readonly EventRow[]; chains: Chains; variant: 'feed' | 'record'; labelledBy?: string }) {
  return (
    <div className="rows-c" data-variant={variant}>
      <div className="tbl">
        <table className="feed" role="table" aria-labelledby={labelledBy}>
          <thead role="rowgroup">
            <tr role="row">
              {(['amount', 'chain', 'type', 'time', 'link'] as const).map((column) => (
                <th key={column} scope="col" role="columnheader">{texts.feed.columns[column]}</th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((row) => <EventTableRow key={row.id} row={row} chains={chains} variant={variant} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
