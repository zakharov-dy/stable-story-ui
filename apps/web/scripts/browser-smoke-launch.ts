// DOM assertions over the accepted home states. No images or pixel comparisons.
import type { Overview } from '@app/contracts';
import type { Page } from 'playwright-core';
import { texts } from '../src/texts.ts';
import { bucketLabel } from '../src/view.ts';

const requireFact = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`home smoke: ${message}`);
};

/** Inspect actual text rectangles, including wrapped labels and values, at each smoke width. */
export async function checkLayout(page: Page): Promise<void> {
  const problems = await page.evaluate(() => {
    const boxes: { text: string; rect: DOMRect }[] = [];
    const walker = document.createTreeWalker(
      document.querySelector('main')!,
      NodeFilter.SHOW_TEXT,
    );
    for (
      let node = walker.nextNode();
      node !== null;
      node = walker.nextNode()
    ) {
      const element = node.parentElement;
      if (
        element === null ||
        !(node.textContent ?? '').trim() ||
        element.closest(
          'svg, script, .sr, .chart-live, .chart-tooltip, .chart-chip, .sticky, .peak',
        )
      )
        continue;
      if (
        !element.checkVisibility({
          visibilityProperty: true,
          opacityProperty: true,
        })
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.height > 0)
          boxes.push({ text: node.textContent!.trim(), rect });
      }
    }
    const errors: string[] = [];
    for (const [index, box] of boxes.entries()) {
      if (box.rect.left < -1 || box.rect.right > innerWidth + 1)
        errors.push(`text outside viewport: ${box.text}`);
      for (const other of boxes.slice(index + 1)) {
        const width =
          Math.min(box.rect.right, other.rect.right) -
          Math.max(box.rect.left, other.rect.left);
        const height =
          Math.min(box.rect.bottom, other.rect.bottom) -
          Math.max(box.rect.top, other.rect.top);
        if (width > 1 && height > 1)
          errors.push(`text overlap: ${box.text} / ${other.text}`);
      }
    }
    for (const node of document.querySelectorAll<HTMLElement>('main *')) {
      if (
        node.closest('.sr, .chart-live, svg') ||
        !node.checkVisibility({ visibilityProperty: true })
      )
        continue;
      if (getComputedStyle(node).textOverflow === 'ellipsis')
        errors.push(`ellipsis: ${node.className}`);
    }
    return errors.slice(0, 12);
  });
  requireFact(problems.length === 0, problems.join('; '));
}

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

export async function checkLaunchInteractions(
  page: Page,
  overview: Overview,
  phone: boolean,
): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await checkLayout(page);
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
  await page.locator('#chain-status summary').click();
  requireFact(
    (await page.locator('table.status tbody tr').count()) ===
      overview.chains.length,
    'every chain has disclosed status',
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
  await checkLayout(page);
  await page.locator('#chain-status summary').click();
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
  await rows.first().hover();
  requireFact(
    (await page.locator('.chart-layer.dimmed').count()) > 0,
    'row hover dims other layers',
  );
  const opacity = await page
    .locator('.chart-layer.dimmed')
    .first()
    .evaluate((node) => getComputedStyle(node).opacity);
  requireFact(opacity === '0.25', 'dimmed token opacity');
  await page.mouse.move(0, 0);
  await page.locator('#h-drivers').scrollIntoViewIfNeeded();
  await page.locator('#sticky-bar').waitFor({ state: 'visible' });
  const stickyFits = await page.locator('#sticky-bar').evaluate((bar) => {
    const boundary = bar.getBoundingClientRect();
    const children = [...bar.children].map((child) =>
      child.getBoundingClientRect(),
    );
    return (
      boundary.height === 48 &&
      children.every((box, index) => {
        const next = children[index + 1];
        return (
          box.left >= boundary.left &&
          box.right <= boundary.right &&
          box.top >= boundary.top &&
          box.bottom <= boundary.bottom &&
          (next === undefined || box.right <= next.left)
        );
      })
    );
  });
  requireFact(
    stickyFits,
    'sticky date and controls fit the 48px bar without overlap',
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
  await page.locator('[data-status-link].sdot').click();
  requireFact(
    (await page.locator('#chain-status').getAttribute('open')) !== null,
    'sticky status opens disclosure',
  );
  await page.locator('#chain-status summary').click();
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
  await page.locator('#chain-status summary').click();
  requireFact(
    (await page.locator('table.status tbody tr').count()) ===
      overview.chains.length,
    'no-JS disclosure',
  );
  await checkLayout(page);
}
