import type { Page } from 'playwright-core';

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
          'svg, script, .sr, .chart-live, .chart-tooltip, .chart-chip, .sticky',
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
  if (problems.length > 0)
    throw new Error(`home smoke: ${problems.join('; ')}`);
}
