import { createMockClient, type MockState, type Overview } from '@app/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatCompact, formatDay } from '../view.ts';
import { withLastDay } from '../test-support/last-day.ts';
import { texts } from '../texts.ts';
import { DayEquation } from './DayEquation.tsx';

const overviewOf = (state: MockState): Promise<Overview> => createMockClient(state).overview();
const render = (overview: Overview): string => renderToStaticMarkup(createElement(DayEquation, { overview }));

/** The cards of the rendered section, in page order. */
const cards = (html: string): string[] => html.split('<article ').slice(1).map((card) => card.slice(0, card.indexOf('</article>')));
const kinds = (card: string): string[] => [...card.matchAll(/data-chip-kind="([^"]+)"/g)].map((match) => match[1] ?? '');
const chip = (card: string, term: string): string => {
  const start = card.indexOf(`<div class="chip`);
  const from = card.indexOf(`data-flow="${term}"`, start);
  return card.slice(card.lastIndexOf('<div', from), card.indexOf('</div>', from));
};

describe('DayEquation', () => {
  it('has one card per chain, in overview.chains order, and none for anything else', async () => {
    const overview = await overviewOf('ok');
    const html = render(overview);
    expect(cards(html)).toHaveLength(overview.chains.length);
    cards(html).forEach((card, index) => {
      expect(card).toContain(`data-chain-index="${index + 1}" data-chain-state="ok"`);
      expect(card).toContain(overview.chains[index]?.name ?? '?');
    });
    expect(html).toContain(texts.equation.scaleNote);
    expect(html).toContain(`${texts.equation.label} · Oct 9`);
    expect(html).not.toContain(`${texts.equation.label} · ${formatDay(overview.asOf)}`);
  });

  it('ignores the all-scope driver entry', async () => {
    const overview = structuredClone(await overviewOf('ok'));
    const all = overview.day!.rows.find((row) => row.scope === 'all');
    if (all === undefined) throw new Error('no all drivers');
    all.values = { issuer_mint: '7', issuer_burn: '0', bridge_in: '0', bridge_out: '0', net: '7' };
    const html = render(overview);
    expect(cards(html)).toHaveLength(overview.chains.length);
    expect(html).not.toContain('data-chain-index="0"');
  });

  it('shows the five terms of the last day of each chain, in the order of the equation', async () => {
    const overview = await overviewOf('ok');
    cards(render(overview)).forEach((card, index) => {
      const driver = overview.views['30d']!.drivers.find((candidate) => candidate.scope === overview.chains[index]?.slug);
      const last = (flow: string) => String(driver?.series.lines.find((line) => line.flow === flow)?.values.at(-1));
      expect(chip(card, 'issuer_mint')).toContain(formatCompact(last('issuer_mint'), { signed: true }));
      expect(chip(card, 'issuer_burn')).toContain(formatCompact(`-${last('issuer_burn')}`, { signed: true }));
      expect(chip(card, 'bridge_out')).toContain(formatCompact(`-${last('bridge_out')}`, { signed: true }));
      expect(chip(card, 'net')).toContain(formatCompact(last('net'), { signed: true }));
      expect(card.indexOf('data-flow="issuer_mint"')).toBeLessThan(card.indexOf('data-flow="issuer_burn"'));
      expect(card.indexOf('data-flow="bridge_out"')).toBeLessThan(card.indexOf('class="op"'));
      expect(card.indexOf('class="op"')).toBeLessThan(card.indexOf('class="chip net"'));
    });
  });

  it('adds no total over the chains', async () => {
    const overview = structuredClone(await overviewOf('ok'));
    const values: Record<string, string> = { ethereum: '1000', base: '2000', arbitrum: '4000' };
    for (const row of overview.day!.rows) row.values.issuer_mint = values[row.scope] ?? '0';
    const html = render(overview);
    expect(html).toContain('+1.00K');
    expect(html).toContain('+2.00K');
    expect(html).toContain('+4.00K');
    expect(html).not.toContain('7.00K');
    expect(html).not.toContain('7,000');
  });

  it('marks the unreconciled card and puts a failed bridge check on the bridge terms only', async () => {
    const overview = await overviewOf('unreconciled');
    const html = render(overview);
    const [ethereum, base, arbitrum] = cards(html);
    expect(overview.status.chains.find((status) => status.chain === 'ethereum')?.reconciliation?.bridge).toBe('mismatch');
    expect(ethereum).toContain('data-unreconciled="true"');
    expect(kinds(ethereum ?? '')).toEqual(['bridge']);
    expect(ethereum).toContain(`${texts.equation.marks.failed}</span>${texts.equation.checks.bridge}`);
    for (const term of ['bridge_in', 'bridge_out']) expect(chip(ethereum ?? '', term)).toContain('data-affected="true"');
    for (const term of ['issuer_mint', 'issuer_burn', 'net']) expect(chip(ethereum ?? '', term)).not.toContain('data-affected');
    for (const other of [base, arbitrum]) {
      expect(other).not.toContain('data-unreconciled');
      expect(kinds(other ?? '')).toEqual(['passed']);
      expect(other).not.toContain('data-affected');
    }
  });

  it('shows a delayed chain with its own checks and the chains ahead with a note about the later day', async () => {
    const overview = await overviewOf('delayed');
    const html = render(overview);
    const result = cards(html);
    overview.chains.forEach((chain, index) => {
      const status = overview.status.chains.find((candidate) => candidate.chain === chain.slug);
      const card = result[index] ?? '';
      expect(card).toContain(`data-chain-state="${status?.state}"`);
      if (status?.state === 'delayed') {
        expect(kinds(card)).toEqual(['passed']);
        // The day the chain has not closed is the one after its last closed day (Oct 8).
        expect(card).toContain(`<span class="tag delayed">${texts.tags.behindNotClosed(String(status.lagHours), 'Oct 9')}</span>`);
      } else {
        // The chain closed a later day: one ✓ that says which day its latest checks are for.
        expect(status?.reconciliation?.day && status.reconciliation.day > (overview.asOf ?? '')).toBe(true);
        expect(kinds(card)).toEqual(['notFlagged']);
        expect(card).toContain(texts.equation.latestChecks('Oct 8', 'Oct 9'));
        expect(card).not.toContain('class="tag delayed"');
      }
    });
  });

  it('names each failed check on its own chip and dashes the terms of the day it puts in question', async () => {
    const overview = structuredClone(await overviewOf('ok'));
    const [first, second, third] = overview.status.chains;
    if (first?.reconciliation == null || second?.reconciliation == null || third?.reconciliation == null) throw new Error('no reconciliation');
    first.reconciliation = { ...first.reconciliation, supply: 'mismatch', supplyDiff: '12.4', continuity: 'mismatch' };
    second.reconciliation = { ...second.reconciliation, continuity: 'mismatch' };
    third.reconciliation = { ...third.reconciliation, continuity: 'none' };
    const [one, two, three] = cards(render(overview));
    expect(kinds(one ?? '')).toEqual(['supply', 'continuity']);
    expect(one).toContain(texts.equation.checks.supply('12.4 USDC'));
    expect(chip(one ?? '', 'net')).toContain('data-affected="true"');
    expect(chip(one ?? '', 'bridge_in')).not.toContain('data-affected');
    expect(kinds(two ?? '')).toEqual(['continuity']);
    expect(two).not.toContain('data-affected'); // continuity changes no term
    expect(kinds(three ?? '')).toEqual(['passed', 'continuityFirst']);
    expect(three).toContain(texts.equation.checks.continuityFirst);
  });

  it('flags a later-day chain whose shown day is in unreconciledDays', async () => {
    const overview = structuredClone(await overviewOf('delayed'));
    const ahead = overview.status.chains.find((status) => status.state !== 'delayed');
    if (ahead === undefined || overview.asOf === null) throw new Error('no chain ahead');
    ahead.unreconciledDays = [overview.asOf];
    const index = overview.chains.findIndex((chain) => chain.slug === ahead.chain);
    const card = cards(render(overview))[index] ?? '';
    expect(kinds(card)).toEqual(['unreconciledDay']);
    expect(card).toContain(texts.equation.checks.unreconciledDay);
    expect(card).not.toContain('data-affected');
  });

  it('shows "no data" and neither bars nor chips for a chain with a null term', async () => {
    const overview = structuredClone(await overviewOf('ok'));
    overview.day!.rows.find((row) => row.scope === overview.chains[1]?.slug)!.values.bridge_in = null;
    const [one, two, three] = cards(render(overview));
    expect(chip(two ?? '', 'bridge_in')).toContain(`>${texts.noData}<`);
    expect(chip(two ?? '', 'bridge_in')).not.toContain('chip-f');
    expect(two).not.toContain('<svg');
    expect(kinds(two ?? '')).toEqual([]);
    expect(two).not.toContain('class="foot"');
    // The other chains are unaffected, bars included.
    for (const other of [one, three]) {
      expect(other).toContain('<svg');
      expect(kinds(other ?? '')).toEqual(['passed']);
    }
  });

  it('gives no chips without a reconciliation', async () => {
    const overview = structuredClone(await overviewOf('ok'));
    const status = overview.status.chains[0];
    if (status === undefined) throw new Error('no status');
    status.reconciliation = null;
    expect(kinds(cards(render(overview))[0] ?? '')).toEqual([]);
  });

  it('renders nothing without asOf', async () => {
    const overview = await overviewOf('empty');
    expect(render(overview)).toBe('');
  });

  it('draws every card on one scale: the smaller chain has the shorter bars', async () => {
    const overview = structuredClone(await overviewOf('ok'));
    const rows = overview.day!.rows.filter((row) => row.scope !== 'all');
    for (const [index, row] of rows.entries()) {
      const value = index === 0 ? '100000' : '1000';
      row.values = { issuer_mint: value, issuer_burn: value, bridge_in: value, bridge_out: value, net: '0' };
    }
    const widths = cards(render(overview)).map((card) => Number(/class="wf-bar issuer-in" x="400" y="3" width="([\d.]+)"/.exec(card)?.[1]));
    expect(widths[0]).toBeGreaterThan(widths[1] ?? Infinity);
    expect(widths[1]).toBeCloseTo((widths[0] ?? 0) / 100, 0);
  });
});

describe('closed · no events', () => {
  const tag = `<span class="tag noevents">${texts.tags.closedNoEvents}</span>`;
  const cardOf = (overview: Overview, chain: string): string => {
    const index = overview.chains.findIndex((candidate) => candidate.slug === chain);
    return cards(render(overview))[index] ?? '';
  };

  it('has the text of the mockup', () => {
    expect(texts.tags.closedNoEvents).toBe('closed · no events');
  });

  it('is on the card of a closed day whose event count is 0, and on no other card', async () => {
    const overview = withLastDay(await overviewOf('ok'), 'arbitrum', { events: 0, flows: 'zero' });
    expect(cardOf(overview, 'arbitrum')).toContain(tag);
    expect(render(overview).split(tag)).toHaveLength(2);
    expect(cardOf(overview, 'ethereum')).not.toContain('no events');
    expect(cardOf(overview, 'base')).not.toContain('no events');
  });

  it('is not on a closed day with four zero flows but events (zero-amount events)', async () => {
    const overview = withLastDay(await overviewOf('ok'), 'arbitrum', { events: 1, flows: 'zero' });
    const card = cardOf(overview, 'arbitrum');
    expect(card).not.toContain('data-missing="true"'); // a real zero, not a gap
    expect(card).not.toContain('no events');
    expect(card).not.toContain('tag noevents');
  });

  it('is not on a day that is not closed for the chain (null flows, null count)', async () => {
    const overview = withLastDay(await overviewOf('ok'), 'arbitrum', { events: null, flows: 'unknown' });
    const card = cardOf(overview, 'arbitrum');
    expect(card).toContain('data-missing="true"');
    expect(card).not.toContain('no events');
  });

  it('is not on a normal day, in any state of the mock catalogue', async () => {
    for (const state of ['ok', 'delayed', 'unreconciled', 'empty-day', 'short-history', 'gap'] as const) {
      expect(render(await overviewOf(state))).not.toContain('no events');
    }
  });

  it('is not shown for a chain that has no drivers entry', async () => {
    const overview = structuredClone(withLastDay(await overviewOf('ok'), 'arbitrum', { events: 0, flows: 'zero' }));
    overview.day!.rows = overview.day!.rows.filter((row) => row.scope !== 'arbitrum');
    expect(cardOf(overview, 'arbitrum')).not.toContain('no events');
  });
});
