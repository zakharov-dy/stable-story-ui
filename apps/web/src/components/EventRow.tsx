import type { EventRow, Overview } from '@app/contracts';
import { chainInfo, signedValue } from '@app/view';
import { texts } from '../texts.ts';
import { formatCompact, formatTime } from '../view.ts';

/** The complete operation row is the explorer link, including both ends of a bridge route. */
export function OperationRow({
  row,
  chains,
}: {
  row: EventRow;
  chains: Overview['chains'];
}) {
  const info = chainInfo(chains, row.chain);
  const amount = signedValue(row.flow, row.amount);
  const peer = row.bridge?.peer;
  return (
    <a
      className="op"
      href={row.explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-operation={row.id}
      data-flow={row.flow}
      data-quality={
        row.unreconciled ? 'unreconciled' : row.unpaired ? 'unpaired' : 'ok'
      }
      data-unreconciled={row.unreconciled ? 'true' : undefined}
      data-unpaired={row.unpaired ? 'true' : undefined}
    >
      <span className="oa">{formatCompact(amount, { signed: true })}</span>
      <span className="or">
        <span className="cdot" data-chain-index={info.index}>
          <span className="dot" />
          {info.name}
        </span>
        {peer === null || peer === undefined ? null : (
          <>
            <span className="arrow">
              {row.flow === 'bridge_in' ? texts.feed.in : texts.feed.out}
            </span>
            <span>{peer.name}</span>
          </>
        )}
      </span>
      <span className="ot">
        <span className="sw" data-flow={row.flow} />
        {texts.flows[row.flow]}
        {row.bridge === null ? null : (
          <span className="tag">{texts.feed.version(row.bridge.version)}</span>
        )}
        {row.bridge !== null && row.bridge.peer === null ? (
          <span className="tag">{texts.tags.peerUnknown}</span>
        ) : null}
        {row.unpaired ? (
          <span className="tag unpaired" data-mark="unpaired">
            {texts.tags.unpaired}
          </span>
        ) : null}
        {row.unreconciled ? (
          <span className="tag unrec" data-mark="unreconciled">
            {texts.tags.unreconciledDay}
          </span>
        ) : null}
      </span>
      <span className="ow">{formatTime(row.time)}</span>
      <span className="oi" aria-hidden="true">
        {texts.feed.link}
      </span>
    </a>
  );
}
