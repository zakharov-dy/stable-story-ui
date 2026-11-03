// Launch-board interactions use a real touch context on phones. Expectations come from the
// supplied overview; independent literal number regressions live beside the components.
import type { Overview } from '@app/contracts';
import type { Page } from 'playwright-core';
import { texts } from '../src/texts.ts';
import { bucketLabel } from '../src/view.ts';

const requireFact = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(`launch smoke: ${message}`);
};

async function aligned(page: Page, section: string): Promise<void> {
  const ok = await page.locator(`${section} .chart-frame`).evaluateAll((frames) => frames.every((frame) => {
    const plot = frame.querySelector('.chart-hover')!.getBoundingClientRect();
    const y = frame.querySelector('.chart-y')!.getBoundingClientRect();
    const x = frame.querySelector('.chart-x');
    const dates = x?.getBoundingClientRect();
    return Math.abs(plot.top - y.top) < 1 && Math.abs(plot.height - y.height) < 1
      && (dates === undefined || (dates.top >= plot.bottom && Math.abs(dates.left - plot.left) < 1));
  }));
  requireFact(ok, 'the pinned row must not offset either axis relative to the plot');
}

export async function checkLaunchInteractions(page: Page, overview: Overview, phone: boolean): Promise<void> {
  for (const period of ['30d', '90d', 'all'] as const) {
    const view = overview.views[period];
    if (view === null) continue;
    const radio = page.locator(`input[name="period"][value="${period}"]`);
    if (await radio.isDisabled()) continue;
    await radio.check();
    requireFact(await page.getByText(texts.resolution.sentence, { exact: true }).count() === 1
      && await page.getByText(texts.resolution.sentence, { exact: true }).isVisible(), 'exactly one resolution sentence');
    const section = `section[data-period="${period}"][aria-labelledby^="h-supply-by-chain"]`;
    const level = page.locator(`${section} .chart-frame.level`);
    const sameAxis = await page.locator(`${section} .chart-hover`).evaluateAll((plots) => {
      const [level, share] = plots.map((plot) => plot.getBoundingClientRect());
      return Math.abs(level.left - share.left) < 1 && Math.abs(level.width - share.width) < 1;
    });
    requireFact(sameAxis, 'level and share panels use the same time axis width');
    const labels = level.locator('.dlab');
    requireFact(await labels.count() === overview.chains.length, 'every chain has a direct label');
    for (const [index, chain] of overview.chains.entries()) {
      const label = level.locator(`.dlab[data-chain-index="${index + 1}"]`);
      requireFact((await label.innerText()).includes(chain.name) && await label.isVisible(), `visible label for ${chain.name}`);
      requireFact(await label.locator('.dlab-value').isVisible(), `${chain.name} level is visible`);
      requireFact(await label.locator('.dlab-share').isVisible() !== phone, 'share appears only on desktop');
    }
    if (!phone) {
      const positions = (await labels.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top))).sort((a, b) => a - b);
      requireFact(positions.slice(1).every((position, index) => Math.abs(position - positions[index] - 30) < 1), '30 px label step');
    }
    const plot = level.locator('.chart-hover');
    await plot.focus();
    await plot.press('End');
    const card = level.locator('.chart-tooltip');
    await card.waitFor({ state: 'visible' });
    requireFact(await level.locator('.chart-ring').count() === overview.chains.length, 'one level marker per chain');
    requireFact(await plot.locator('title').count() === 0, 'no competing native tooltip');
    requireFact(await level.locator('.chart-ring').first().evaluate((node) => getComputedStyle(node).width === '5px'), 'marker token gives 5 px diameter');
    const last = view.supplyByChain.level.buckets.at(-1)!;
    requireFact((await card.innerText()).includes(bucketLabel(last)), 'last bucket date is correct');
    if (period !== '30d') requireFact((await card.innerText()).includes('incomplete period'), 'cut bucket quality is shown');
    if (phone) {
      await plot.press('Escape');
      await plot.blur();
      await plot.locator('.chart-hit').last().tap();
      const pin = level.locator('.chart-tooltip[data-pinned="true"]');
      await pin.waitFor({ state: 'visible' });
      requireFact(await pin.evaluate((node) => node.parentElement?.classList.contains('chart-frame') === true), 'pin is a sibling outside the measured plot');
      requireFact((await pin.innerText()).includes(bucketLabel(last)), 'tap keeps its selected bucket');
      if (period !== '30d') requireFact((await pin.innerText()).includes('incomplete period'), 'pin keeps quality');
      const above = await pin.evaluate((node) => node.getBoundingClientRect().bottom <= node.parentElement!.querySelector('.chart-hover')!.getBoundingClientRect().top);
      requireFact(above, 'phone card is above the plot');
      await aligned(page, section);
      await pin.getByRole('button', { name: 'Close tooltip' }).tap();
      requireFact(await level.locator('.chart-tooltip').count() === 0, 'close dismisses the pinned card');
      await aligned(page, section);
    } else {
      requireFact(await card.getAttribute('data-side') === 'left', 'card flips left at the right edge');
      await plot.press('Escape');
    }
    const driver = page.locator(`figure[data-period="${period}"][data-pos="0"] .chart-hover`);
    await driver.focus();
    await driver.press('End');
    const flowCard = driver.locator('.chart-tooltip');
    requireFact(await flowCard.locator('.chart-tooltip-head').count() === 0, '04 starts with a flow, without duplicate scope header');
    requireFact((await flowCard.locator('.chart-tooltip-row').first().innerText()).includes('issuer mint'), '04 first row is issuer mint');
    requireFact((await flowCard.innerText()).includes(`sum per ${view.period}, all chains`), '04 footer names step and scope');
    requireFact(await driver.locator('.chart-ring[data-flow="net"]').count() === 1, '04 has one net marker');
    await driver.press('Escape');
  }
  await page.check('input[name="period"][value="30d"]');
  if (!phone) {
    const size = page.viewportSize()!;
    await page.setViewportSize({ ...size, width: 1280 });
    const fits = await page.locator('table.status tbody tr').evaluateAll((rows) => rows.every((row) => {
      const cells = row.querySelectorAll('td');
      const run = cells[4]?.querySelector('.sv');
      return run === null || run === undefined || cells[5] === undefined
        || run.getBoundingClientRect().right <= cells[5].getBoundingClientRect().left;
    }));
    requireFact(fits, 'Last run does not overlap Mismatched days at 1280');
    await page.setViewportSize(size);
  }
}
