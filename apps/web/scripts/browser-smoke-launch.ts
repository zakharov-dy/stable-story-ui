// DOM assertions over the accepted home states. No images or pixel comparisons.
import type { Overview } from '@app/contracts';
import { historyDays } from '@app/view';
import type { Page } from 'playwright-core';
import { texts } from '../src/texts.ts';
import {
  bucketLabel,
  formatCount,
  formatDay,
  PERIOD_ORDER,
} from '../src/view.ts';
import { checkLayout } from './browser-smoke-layout.ts';

const requireFact = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`home smoke: ${message}`);
};

async function chainGrowth(page: Page): Promise<void> {
  await page.evaluate(() => {
    const list = document.querySelector('.clist')!;
    const choices = document.querySelector('.scope-choices')!;
    const source = list.querySelector('.crow')!;
    const chip = choices.querySelector('.scope-option')!;
    for (
      let index = list.querySelectorAll('.crow').length + 1;
      index <= 11;
      index += 1
    ) {
      const row = source.cloneNode(true) as HTMLElement;
      row.dataset.chainIndex = String(index);
      row.dataset.growth = 'true';
      row.querySelector('.cn')!.textContent = `Long placeholder chain ${index}`;
      list.append(row);
      const option = chip.cloneNode(true) as HTMLElement;
      option.dataset.growth = 'true';
      option.querySelector('.scope-plots')?.remove();
      const label = option.querySelector('label')!;
      label.dataset.chainIndex = String(index);
      label.querySelector('input')!.name = 'growth-chain';
      label.querySelector('input')!.checked = false;
      label.append(document.createTextNode(` Long placeholder ${index}`));
      choices.append(option);
    }
  });
  try {
    await checkLayout(page);
    const colours = await page
      .locator('.crow .dot')
      .evaluateAll((dots) =>
        dots.map((dot) => getComputedStyle(dot).backgroundColor),
      );
    requireFact(
      new Set(colours.slice(0, 10)).size === 10,
      'ten distinct chain colour slots',
    );
    const fallback = await page
      .locator('.crow')
      .last()
      .evaluate((row) => ({
        actual: getComputedStyle(row.querySelector('.dot')!).backgroundColor,
        token: getComputedStyle(row).getPropertyValue('--color-border').trim(),
      }));
    requireFact(
      fallback.actual !== 'rgba(0, 0, 0, 0)' && fallback.token !== '',
      'chain eleven has a readable default swatch',
    );
  } finally {
    await page
      .locator('[data-growth]')
      .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  }
}

/** The operations disclosure sits after the last row in both states and every row opens in a new tab. */
async function checkOperationsControl(
  page: Page,
  overview: Overview,
  keyboardOpen: boolean,
): Promise<void> {
  const feed = page.locator('[data-block="feed"]');
  const links = feed.locator('a.op');
  const total = overview.largestEvents.items.length;
  requireFact((await links.count()) === total, 'every operation row links');
  const facts = await links.evaluateAll((nodes) =>
    nodes.map((node) => ({
      href: node.getAttribute('href'),
      target: node.getAttribute('target'),
      rel: node.getAttribute('rel'),
    })),
  );
  overview.largestEvents.items.forEach((row, index) => {
    requireFact(
      facts[index]?.href === row.explorerUrl,
      `operation URL ${row.id}`,
    );
    requireFact(
      facts[index]?.target === '_blank',
      `operation new-tab ${row.id}`,
    );
    requireFact(
      facts[index]?.rel === 'noopener noreferrer',
      `operation rel ${row.id}`,
    );
  });
  const disclosure = feed.locator('details.operations-more');
  if (total <= 5) {
    requireFact(
      (await disclosure.count()) === 0,
      'no control for five or fewer rows',
    );
    return;
  }
  requireFact((await disclosure.count()) === 1, 'one operations control');
  const control = feed.locator('details.operations-more > summary');
  const arrow = control.locator('svg');
  // Closed disclosure content keeps layout boxes (content-visibility), so visibility
  // is read from rendering, not geometry.
  const visibleRows = () =>
    feed
      .locator('.op')
      .evaluateAll(
        (nodes) =>
          nodes.filter((node) =>
            (node as HTMLElement).checkVisibility({
              opacityProperty: true,
              visibilityProperty: true,
            }),
          ).length,
      );
  const controlBelowLastRow = (): Promise<boolean> =>
    control.evaluate((summary) => {
      const rendered = (node: Element): boolean =>
        (node as HTMLElement).checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        });
      const block = summary.closest('[data-block="feed"]')!;
      const rows = [...block.querySelectorAll('.op')].filter(rendered);
      const last = rows.at(-1)?.getBoundingClientRect();
      const box = summary.getBoundingClientRect();
      return last !== undefined && box.top >= last.bottom - 1;
    });
  const arrowTransform = (): Promise<string> =>
    arrow.evaluate((node) => getComputedStyle(node).transform);
  requireFact((await visibleRows()) === 5, 'closed operations show five rows');
  requireFact(
    (await control.innerText()).includes(texts.feed.showAll(total)),
    'closed control label',
  );
  requireFact((await arrowTransform()) !== 'none', 'closed arrow points down');
  requireFact(await controlBelowLastRow(), 'closed control after the fifth row');
  if (keyboardOpen) {
    await control.focus();
    await page.keyboard.press('Enter');
  } else {
    await control.click();
  }
  requireFact((await visibleRows()) === total, 'open operations show every row');
  requireFact(await control.isHidden(), 'the control disappears when open');
}

export async function checkLaunchInteractions(
  page: Page,
  overview: Overview,
  phone: boolean,
): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await checkLayout(page);
  if (page.viewportSize()?.width === 1280 && overview.chains.length === 6) {
    const fits = await page.evaluate(() => {
      const top = document
        .querySelector('.brand-row')!
        .getBoundingClientRect().top;
      const plot = document
        .querySelector('.stack-panel .chart-hover')!
        .getBoundingClientRect();
      const list = document.querySelector('.clist')!.getBoundingClientRect();
      return plot.bottom - top <= 800 && list.bottom - top <= 800;
    });
    requireFact(
      fits,
      'the desktop stack plot and chain list fit the first 800px',
    );
  }
  const rows = page.locator('.crow');
  requireFact(
    (await rows.count()) === overview.chains.length,
    'every enabled chain in the list',
  );
  const names = await rows.locator('.cn').allTextContents();
  requireFact(
    JSON.stringify(names) ===
      JSON.stringify(overview.chains.map((chain) => chain.name)),
    'API chain order',
  );
  const colours = await rows
    .locator('.dot')
    .evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).backgroundColor),
    );
  requireFact(
    new Set(colours).size === overview.chains.length,
    'distinct enabled chain colours',
  );
  requireFact(
    (await page.locator('table.status tbody tr').count()) ===
      overview.chains.length,
    'every chain has a status row',
  );
  requireFact(
    (await page.locator('#chain-status details, #chain-status summary').count()) ===
      0,
    'the status section needs no disclosure',
  );
  for (const chain of overview.status.chains) {
    const row = page.locator(`table.status tr[data-chain="${chain.chain}"]`);
    requireFact(
      (await row.getAttribute('data-chain-state')) === chain.state,
      `${chain.chain} state`,
    );
    if (chain.state === 'delayed')
      requireFact(
        (await row.innerText()).includes(`${chain.lagHours} h behind`),
        'disclosed delay',
      );
  }
  const brandLink = page.locator('.brand-row a[href="#chain-status"]');
  const delayedChains = overview.status.chains.filter(
    (status) => status.state === 'delayed',
  );
  if (delayedChains.length > 0) {
    const first = delayedChains[0];
    requireFact(
      (await brandLink.count()) === delayedChains.length,
      'delayed notes are the brand-row links',
    );
    requireFact(
      (await brandLink.first().innerText()).includes(
        texts.tags.behind(
          overview.chains.find((chain) => chain.slug === first.chain)?.name ??
            first.chain,
          formatCount(first.lagHours),
        ),
      ),
      'delayed brand note links to the status section',
    );
  } else {
    requireFact(
      (await brandLink.count()) === 1,
      'one brand link to the status section',
    );
    requireFact(
      (await brandLink.innerText()).includes(
        texts.header.reconciled(
          formatCount(overview.reconciliation.reconciledChains),
          formatCount(overview.chains.length),
        ),
      ),
      'brand tally links to the status section',
    );
  }
  if (phone) {
    requireFact(
      (await page.locator('.status-list li').count()) ===
        overview.chains.length,
      'phone status rows',
    );
    requireFact(
      await page.locator('table.status').isHidden(),
      'phone shows the status list',
    );
    const listColours = await page
      .locator('.status-list li .dot')
      .evaluateAll((dots) =>
        dots.map((dot) => getComputedStyle(dot).backgroundColor),
      );
    requireFact(
      new Set(listColours).size === overview.chains.length,
      'phone status rows carry the chain colours',
    );
    const listOrder = await page
      .locator('.status-list li')
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute('data-chain-index')),
      );
    requireFact(
      JSON.stringify(listOrder) ===
        JSON.stringify(overview.chains.map((_, index) => String(index + 1))),
      'phone status rows in registry order',
    );
  }
  await checkLayout(page);
  // The board default is computed from the accepted rule, not from the page's
  // own availability set: ALL first, 90D and 30D after it; ALL needs more than
  // 90 days of history, so short history opens on 90D.
  const expectedDefault =
    overview.views.all !== null && historyDays(overview) > 90
      ? 'all'
      : overview.views['90d'] !== null
        ? '90d'
        : '30d';
  const allOff = overview.views.all === null || historyDays(overview) <= 90;
  requireFact(
    (await page.locator('input[name="period"][value="all"]').isDisabled()) ===
      allOff,
    'ALL availability follows the 90-day rule',
  );
  requireFact(
    (await page.locator('input[name="period"][value="90d"]').isDisabled()) ===
      (overview.views['90d'] === null),
    '90D stays available when the server supplies it',
  );
  requireFact(
    (await page
      .locator('#sticky-bar [data-sticky-period="all"]')
      .isDisabled()) === allOff,
    'sticky ALL availability follows the 90-day rule',
  );
  if (allOff && overview.historyStart !== null)
    requireFact(
      await page
        .getByText(
          texts.period.allNote(formatDay(overview.historyStart)),
          { exact: true },
        )
        .isVisible(),
      'the ALL reason names the history start',
    );
  requireFact(
    await page
      .locator(`input[name="period"][value="${expectedDefault}"]`)
      .isChecked(),
    'the board default period is checked',
  );
  const periodOrder = PERIOD_ORDER.map((period) => texts.period.options[period]);
  const headOrder = await page.locator('#period label span').allTextContents();
  requireFact(
    JSON.stringify(headOrder) === JSON.stringify(periodOrder),
    'chart head period order ALL · 90D · 30D',
  );
  const stickyOrder = await page
    .locator('#sticky-bar [data-sticky-period]')
    .evaluateAll((buttons) =>
      buttons.map((button) => button.textContent?.trim() ?? ''),
    );
  requireFact(
    JSON.stringify(stickyOrder) === JSON.stringify(periodOrder),
    'sticky bar period order ALL · 90D · 30D',
  );
  requireFact(
    (await page
      .locator(`#sticky-bar [data-sticky-period="${expectedDefault}"]`)
      .getAttribute('aria-pressed')) === 'true',
    'sticky default period pressed',
  );
  requireFact(
    await page
      .locator(
        `section[data-period="${expectedDefault}"][aria-labelledby^="h-supply-by-chain"]`,
      )
      .isVisible(),
    'default stack visible',
  );
  requireFact(
    await page
      .locator(`figure[data-period="${expectedDefault}"][data-scope="all"]`)
      .isVisible(),
    'flows follow the default period',
  );
  await checkOperationsControl(page, overview, false);
  if (overview.chains.length === 6) await chainGrowth(page);

  for (const period of ['30d', '90d', 'all'] as const) {
    const radio = page.locator(`input[name="period"][value="${period}"]`);
    if (await radio.isDisabled()) continue;
    await radio.check({ force: true });
    const view = overview.views[period]!;
    const section = page.locator(
      `section[data-period="${period}"][aria-labelledby^="h-supply-by-chain"]`,
    );
    requireFact(await section.isVisible(), `${period} stack visible`);
    requireFact(
      await page
        .getByText(texts.resolution.sentence, { exact: true })
        .isVisible(),
      'older-period sentence visible',
    );
    await page
      .locator('input[name="stack-mode"][value="level"]')
      .check({ force: true });
    const frame = section.locator('.chart-frame.level');
    const plot = frame.locator('.chart-hover');
    const mapped = await section.locator('.chart-layer').evaluateAll(
      (layers, chains) =>
        layers.every((layer) => {
          const expected =
            chains.findIndex(
              (chain) => chain.slug === layer.getAttribute('data-chain'),
            ) + 1;
          const row = document.querySelector(
            `.crow[data-chain-index="${expected}"]`,
          );
          return (
            layer.getAttribute('data-chain-index') === String(expected) &&
            row !== null &&
            getComputedStyle(layer).getPropertyValue('--chain-color') ===
              getComputedStyle(row).getPropertyValue('--chain-color')
          );
        }),
      overview.chains,
    );
    requireFact(mapped, 'stack identity and colour follow registry order');
    await plot.focus();
    await plot.press('End');
    requireFact(
      (await frame.locator('.chart-tooltip').innerText()).includes(
        bucketLabel(view.supplyByChain.level.buckets.at(-1)!),
      ),
      'last ready bucket date',
    );
    requireFact(
      (await page.locator('.chart-tip:visible').count()) === 1,
      'one chart tooltip',
    );
    requireFact(
      (await page.locator('svg title').count()) === 0,
      'zero native SVG titles after hydration',
    );
    await plot.press('Home');
    await plot.press('ArrowRight');
    const absent = view.noDataChains?.[1] ?? [];
    const missing = view.supplyByChain.level.lines.some(
      (line) => line.values[1] === null && !absent.includes(line.key),
    );
    const knownCount = missing
      ? 0
      : view.supplyByChain.level.lines.filter((line) => line.values[1] !== null)
          .length;
    requireFact(
      (await frame.locator('.chart-ring').count()) === knownCount,
      'markers follow the ready known layers',
    );
    await plot.press('Escape');
    await plot.blur();
    if (phone) {
      await plot.locator('.chart-hit').last().tap();
      const pin = frame.locator('.chart-tooltip[data-pinned="true"]');
      await pin.waitFor({ state: 'visible' });
      requireFact(
        await pin.evaluate(
          (node) =>
            node.getBoundingClientRect().bottom <=
            node
              .parentElement!.querySelector('.chart-hover')!
              .getBoundingClientRect().top,
        ),
        'touch card above the plot',
      );
      await pin
        .getByRole('button', { name: texts.resolution.closeTooltip })
        .tap();
      requireFact(
        (await frame.locator('.chart-tip').count()) === 0,
        'touch close',
      );
    }
    await page
      .locator('input[name="stack-mode"][value="share"]')
      .check({ force: true });
    requireFact(
      (await section.locator('.chart-frame.share').isVisible()) &&
        !(await frame.isVisible()),
      'single Level or Share panel',
    );
    await page
      .locator('input[name="stack-mode"][value="level"]')
      .check({ force: true });
    for (const scope of [
      'all',
      ...overview.chains.map((chain) => chain.slug),
    ]) {
      await page
        .locator(`input[name="chain"][value="${scope}"]`)
        .check({ force: true });
      const driver = page.locator(
        `figure[data-period="${period}"][data-scope="${scope}"]`,
      );
      requireFact(await driver.isVisible(), `${period} ${scope} flow chart`);
      await driver.locator('.chart-hover').focus();
      await driver.locator('.chart-hover').press('End');
      requireFact(
        (await driver.locator('.chart-ring[data-flow="net"]').count()) <= 1,
        'only net flow marker',
      );
      requireFact(
        (await page.locator('.chart-tip:visible').count()) === 1,
        'one flow tooltip',
      );
      await driver.locator('.chart-hover').press('Escape');
      await driver.locator('.chart-hover').blur();
    }
    await checkLayout(page);
  }
  await page.locator('input[name="chain"][value="all"]').check({ force: true });
  await page
    .locator('input[name="period"][value="30d"]')
    .check({ force: true });
  for (const [index, chain] of overview.chains.entries()) {
    await rows.nth(index).hover();
    const matched = await page
      .locator('.chart-layer')
      .evaluateAll(
        (layers, slug) =>
          layers.every(
            (layer) =>
              layer.classList.contains('dimmed') ===
              (layer.getAttribute('data-chain') !== slug),
          ),
        chain.slug,
      );
    requireFact(
      matched,
      `hover dims exactly the other layers for ${chain.slug}`,
    );
  }
  const opacity = await page
    .locator('.chart-layer.dimmed')
    .first()
    .evaluate((node) => getComputedStyle(node).opacity);
  requireFact(opacity === '0.25', 'dimmed token opacity');
  await page.mouse.move(0, 0);
  await page.locator('#h-drivers').scrollIntoViewIfNeeded();
  await page.locator('#sticky-bar').waitFor({ state: 'visible' });
  requireFact(
    (await page.locator('#sticky-bar .sdot').count()) === 0,
    'no status button in the sticky bar',
  );
  const stickyFits = await page.locator('#sticky-bar').evaluate((bar) => {
    const boundary = bar.getBoundingClientRect();
    const column = bar.querySelector('.sticky-in')!;
    const inner = column.getBoundingClientRect();
    const children = [...column.children].map((child) =>
      child.getBoundingClientRect(),
    );
    const contentEdge = Math.min(innerWidth, 1280);
    return (
      boundary.height === 48 &&
      Math.abs(inner.width - contentEdge) <= 1 &&
      children.every((box, index) => {
        const next = children[index + 1];
        return (
          box.left >= boundary.left &&
          box.right <= boundary.right &&
          box.top >= boundary.top &&
          box.bottom <= boundary.bottom &&
          (next === undefined || box.right <= next.left)
        );
      }) &&
      // Wordmark at the column's left edge; date and period together at its right.
      children[0].left - inner.left <= 81 &&
      inner.right - children[children.length - 1].right <= 81
    );
  });
  requireFact(
    stickyFits,
    'sticky wordmark, date and period fill the 48px content column without overlap',
  );
  const stickyPeriod = page.locator('[data-sticky-period="90d"]');
  if (!(await stickyPeriod.isDisabled())) {
    await stickyPeriod.click();
    requireFact(
      await page.locator('input[name="period"][value="90d"]').isChecked(),
      'sticky period drives native control',
    );
    await page.locator('[data-sticky-period="30d"]').click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#sticky-bar').waitFor({ state: 'hidden' });
  await checkLayout(page);
}

/** The principal controls keep their behavior without hydration. */
export async function checkNoJavascript(
  page: Page,
  overview: Overview,
): Promise<void> {
  for (const period of ['30d', '90d', 'all'] as const) {
    const radio = page.locator(`input[name="period"][value="${period}"]`);
    if (await radio.isDisabled()) continue;
    await radio.check({ force: true });
    requireFact(
      await page
        .locator(
          `section[data-period="${period}"][aria-labelledby^="h-supply-by-chain"]`,
        )
        .isVisible(),
      `no-JS ${period} stack`,
    );
    requireFact(
      await page
        .locator(`figure[data-period="${period}"][data-scope="all"]`)
        .isVisible(),
      `no-JS ${period} flows`,
    );
  }
  requireFact(
    (await page
      .locator('#chain-status details, #chain-status summary')
      .count()) === 0,
    'no-JS status section needs no disclosure',
  );
  requireFact(
    (await page.locator('table.status tbody tr').count()) ===
      overview.chains.length,
    'no-JS status table',
  );
  await checkOperationsControl(page, overview, true);
  await checkLayout(page);
}
