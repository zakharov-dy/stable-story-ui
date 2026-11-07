// Checks of the server HTML of the page, shared by the unit tests (rendering the root server
// component) and scripts/check-build.ts (plain HTTP against `next start`). Expected values come from
// the overview the page was given, never from literals. Returns the list of problems.

import type { Overview } from '@app/contracts';
import {
  formatCompact,
  formatCount,
  formatDay,
  formatShortDay,
  roundedChange,
} from '../view.ts';
import { texts } from '../texts.ts';
import {
  fromQuality,
  qualityAttribute,
  merge,
  signedValue,
  TERMS,
} from '@app/view';

export const DATA_BLOCKS = [
  'header',
  'waterfall',
  'supply-by-chain',
  'drivers',
  'feed',
  'records',
] as const;
export const ALL_BLOCKS = [
  ...DATA_BLOCKS,
  'status',
  'how-we-count',
  'disclaimer',
] as const;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
};

/** The markup without scripts (the RSC payload repeats the props as JSON) and styles. */
export const withoutScripts = (html: string): string =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<style\b[\s\S]*?<\/style>/g, '');

/** What a reader sees: tags removed, entities decoded, whitespace collapsed. */
export const visibleText = (html: string): string =>
  withoutScripts(html)
    .replace(/<title>[\s\S]*?<\/title>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(
      /&(?:amp|lt|gt|quot|#x27|#39);/g,
      (entity) => ENTITIES[entity] ?? entity,
    )
    .replace(/\s+/g, ' ')
    .trim();

const count = (html: string, fragment: string): number =>
  html.split(fragment).length - 1;

/** SVGs that draw something: the decorative ones (wordmark, pattern definitions) are aria-hidden. */
const chartSvgs = (markup: string): number =>
  (markup.match(/<svg\b[^>]*>/g) ?? []).filter(
    (tag) => !tag.includes('aria-hidden="true"'),
  ).length;

/** The markup from the first `start` to the first `end` after it (or to the end). */
function slice(markup: string, start: string, end: string): string {
  const from = markup.indexOf(start);
  if (from < 0) return '';
  const to = markup.indexOf(end, from + start.length);
  return markup.slice(from, to < 0 ? undefined : to);
}

/** Every constant string of texts.ts: static copy that may legitimately contain digits. */
function staticTexts(): string[] {
  const strings: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === 'object')
      Object.values(value).forEach(walk);
  };
  walk(texts);
  return strings
    .filter((text) => text.length > 0)
    .sort((a, b) => b.length - a.length);
}

/** The visible text with the static copy removed: what is left is data. */
export function dataText(html: string, demoState: string | null): string {
  let text = visibleText(html);
  const copy = [
    ...(demoState === null ? [] : [texts.demo(demoState)]),
    ...staticTexts(),
  ];
  for (const fragment of copy) text = text.split(fragment).join(' ');
  return text;
}

export interface PageExpectation {
  overview: Overview | null; // null: the API failed
  demoState: string | null;
}

export function checkPageHtml(
  html: string,
  { overview, demoState }: PageExpectation,
): string[] {
  const problems: string[] = [];
  const markup = withoutScripts(html);
  const text = visibleText(html);
  const expect = (condition: boolean, message: string) => {
    if (!condition) problems.push(message);
  };
  const state =
    overview === null
      ? 'unavailable'
      : overview.asOf === null
        ? 'empty'
        : 'data';
  expect(
    count(markup, `data-page-state="${state}"`) === 1,
    `expected page state ${state}`,
  );
  expect(
    count(markup, '<h1') === 1 && text.includes(texts.productName),
    'expected one product heading',
  );
  expect(
    count(markup, 'data-demo-state=') === (demoState === null ? 0 : 1),
    'demo label count',
  );
  if (demoState !== null)
    expect(text.includes(texts.demo(demoState)), 'demo label text');
  for (const removed of [
    'data-kpi=',
    'data-block="day-equation"',
    'data-block="issuer-vs-bridge"',
    'class="spark"',
    'class="cadence"',
    'data-incomplete=',
  ]) {
    expect(!markup.includes(removed), `obsolete page element ${removed}`);
  }
  if (overview === null || overview.asOf === null) {
    for (const block of ALL_BLOCKS)
      expect(
        !markup.includes(`data-block="${block}"`),
        `${state} must not draw ${block}`,
      );
    expect(chartSvgs(markup) === 0, `${state} must not draw charts`);
    expect(
      text.includes(
        state === 'empty'
          ? texts.states.emptyBody
          : texts.states.unavailableBody,
      ),
      'state explanation',
    );
    if (overview === null) {
      expect(
        markup.includes('name="robots" content="noindex"'),
        'outage noindex',
      );
      expect(
        !markup.includes('data-chain-state='),
        'outage must not draw chain states',
      );
      expect(markup.includes(`href="/"`), 'outage reload link');
    } else {
      expect(
        count(markup, 'data-chain-state=') === overview.chains.length,
        'empty chain dots',
      );
    }
    return problems;
  }
  for (const block of ALL_BLOCKS)
    expect(
      count(markup, `data-block="${block}"`) === 1,
      `expected ${block} once`,
    );
  for (const place of ['brand', 'sticky']) {
    const date = slice(markup, `data-date="${place}"`, '</');
    expect(
      visibleText(date).includes(texts.asOf(formatDay(overview.asOf))),
      `${place} needs the full data date`,
    );
  }
  expect(
    count(markup, texts.resolution.sentence) === 1,
    'one older-period sentence',
  );
  expect(
    visibleText(slice(markup, 'class="stamp"', '</p>')).includes(
      texts.header.stamp(
        formatCount(overview.reconciliation.reconciledChains),
        formatCount(overview.chains.length),
        formatCount(overview.reconciliation.all.mismatchedDays),
        formatCount(overview.reconciliation.all.closedDays),
      ),
    ),
    'ready reconciliation stamp',
  );
  const header = slice(markup, 'data-block="header"', '</section>');
  expect(
    visibleText(header).includes(formatCompact(overview.header.supply.value)),
    'tracked supply value',
  );
  for (const key of ['change1d', 'change7d'] as const)
    expect(
      visibleText(header).includes(roundedChange(overview.header[key].value)),
      `${key} ready amount`,
    );
  const day = overview.day?.rows.find((row) => row.scope === 'all');
  const waterfall = slice(header, 'data-block="waterfall"', '</figure>');
  for (const term of TERMS)
    expect(
      visibleText(waterfall).includes(
        roundedChange(signedValue(term, day?.values[term] ?? null)),
      ),
      `waterfall ${term} from all row`,
    );
  const list = slice(markup, 'class="clist"', '</div></div>');
  const rows = [...list.matchAll(/<a\b[^>]*class="crow"[\s\S]*?<\/a>/g)].map(
    (match) => match[0],
  );
  expect(rows.length === overview.chains.length, 'chain-list row count');
  const statusTable = slice(markup, '<table class="status"', '</table>');
  overview.chains.forEach((chain, index) => {
    const status = overview.status.chains.find(
      (candidate) => candidate.chain === chain.slug,
    );
    const row = rows[index] ?? '';
    expect(
      row.includes(`data-chain="${chain.slug}"`) &&
        row.includes(`data-chain-index="${index + 1}"`),
      `chain order ${chain.slug}`,
    );
    expect(
      row.includes(`data-chain-state="${status?.state}"`),
      `list state ${chain.slug}`,
    );
    expect(
      statusTable.includes(`data-chain="${chain.slug}"`) &&
        statusTable.includes(`data-chain-state="${status?.state}"`),
      `disclosed state ${chain.slug}`,
    );
    if (status?.state === 'delayed')
      expect(
        text.includes(
          texts.tags.behind(chain.name, formatCount(status.lagHours)),
        ),
        `delayed lag ${chain.slug}`,
      );
  });
  const operations = [
    ...markup.matchAll(/<a\b[^>]*data-operation="([^"]+)"[^>]*>/g),
  ].map((match) => match[0]);
  expect(
    operations.length === overview.largestEvents.items.length,
    'operation row count including disclosure',
  );
  for (const [index, row] of overview.largestEvents.items.entries()) {
    const tag = operations[index] ?? '';
    expect(
      tag.includes(`href="${row.explorerUrl}"`),
      `operation URL ${row.id}`,
    );
    expect(
      tag.includes('target="_blank"'),
      `operation new-tab target ${row.id}`,
    );
    expect(
      tag.includes('rel="noopener noreferrer"'),
      `operation rel ${row.id}`,
    );
    expect(
      tag.includes('data-unreconciled="true"') === row.unreconciled,
      `operation reconciliation ${row.id}`,
    );
    expect(
      tag.includes('data-unpaired="true"') === row.unpaired,
      `operation pairing ${row.id}`,
    );
  }
  expect(
    count(markup, 'class="operations-more"') ===
      (overview.largestEvents.items.length > 5 ? 1 : 0),
    'nonempty operations disclosure',
  );
  const feed = slice(markup, 'data-block="feed"', '</section>');
  const feedSummaries = count(feed, '<summary');
  expect(
    feedSummaries === (overview.largestEvents.items.length > 5 ? 1 : 0),
    'feed disclosure control count',
  );
  expect(
    count(feed, 'class="oplist"') === 1,
    'feed rows form one list',
  );
  if (overview.largestEvents.items.length > 5) {
    expect(
      feed.includes(texts.feed.showAll(overview.largestEvents.items.length)),
      'closed control label',
    );
    expect(feed.includes(texts.feed.showFive), 'open control label');
    expect(
      /<details class="operations-more">\s*<summary/.test(feed),
      'the summary opens the disclosure',
    );
    const details = feed.indexOf('<details class="operations-more">');
    const close = feed.indexOf('</details>', details);
    expect(
      count(feed.slice(details, close), 'data-operation=') ===
        overview.largestEvents.items.length - 5,
      'the disclosure wraps every additional row',
    );
    const controlMarkup = feed.slice(details, close);
    expect(
      controlMarkup.includes('<svg') &&
        controlMarkup.includes('aria-hidden="true"'),
      'board chevron on the control',
    );
    expect(
      controlMarkup.includes('<path d="M3 7.5l3-3 3 3"'),
      'board chevron shape',
    );
    expect(!feed.includes('⌄'), 'no native marker text on the feed control');
  }
  expect(
    count(markup, 'data-record=') ===
      overview.records.filter((record) => record.scope === 'all').length,
    'scope-all records',
  );
  const displayed = [
    overview.header.supply,
    overview.header.change1d,
    overview.header.change7d,
  ];
  const headerQuality = qualityAttribute(
    merge(displayed.map((card) => fromQuality(card.quality))),
  );
  const headerTag =
    /<section\b(?=[^>]*data-block="header")[^>]*>/.exec(markup)?.[0] ?? '';
  expect(
    headerTag.includes(`data-quality="${headerQuality}"`),
    'header quality must include every displayed figure',
  );
  const incomplete = displayed.some((card) => !card.quality.complete);
  expect(
    header.includes('data-header-note="incomplete"') === incomplete,
    'header incomplete note must explain every displayed figure',
  );
  const brand = slice(markup, '<header class="brand-row"', '</header>');
  expect(
    visibleText(brand).includes(
      texts.header.reconciled(
        formatCount(overview.reconciliation.reconciledChains),
        formatCount(overview.chains.length),
      ),
    ),
    'brand ready tally in every data state',
  );
  for (const status of overview.status.chains) {
    if (
      status.lastClosedDay === null ||
      !status.unreconciledDays.includes(status.lastClosedDay)
    )
      continue;
    const name =
      overview.chains.find((chain) => chain.slug === status.chain)?.name ??
      status.chain;
    expect(
      visibleText(header).includes(
        texts.tags.chainUnreconciled(
          name,
          formatShortDay(status.lastClosedDay),
        ),
      ),
      `header latest mismatched day for ${status.chain}`,
    );
  }
  expect(
    slice(markup, 'data-block="feed"', '</section>').includes(
      'data-quality="' +
        qualityAttribute(fromQuality(overview.largestEvents.quality)) +
        '"',
    ),
    'feed quality',
  );
  for (const period of ['30d', '90d', 'all'] as const) {
    const view = overview.views[period];
    if (view === null) continue;
    expect(markup.includes(`data-period="${period}"`), `ready ${period} view`);
    expect(
      view.period ===
        ({ '30d': 'day', '90d': 'week', all: 'month' } as const)[period],
      `server step ${period}`,
    );
  }
  return problems;
}
