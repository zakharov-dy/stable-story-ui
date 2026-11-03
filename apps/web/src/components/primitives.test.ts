import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { texts } from '../texts.ts';
import { fromQuality, merge } from '@app/view';
import { QualityNote } from './QualityNote.tsx';
import { SectionHeading } from './SectionHeading.tsx';

const quality = { complete: true, unreconciledDays: [] as string[], operationsComplete: true, unpairedEvents: 0 };

describe('SectionHeading', () => {
  it('renders the numbered label, headline and caption from its props and texts', () => {
    const html = renderToStaticMarkup(createElement(SectionHeading, { index: 3, label: 'Label', title: 'Title', caption: 'Caption' }));
    expect(html).toContain(`<span class="ix">${texts.section.label(3)}</span>Label`);
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<p>Caption</p>');
    expect(texts.section.label(3)).toBe('/// 03');
    expect(texts.section.label(12)).toBe('/// 12');
  });
});

describe('QualityNote', () => {
  const render = (props: Parameters<typeof QualityNote>[0]) => renderToStaticMarkup(createElement(QualityNote, props));

  it('renders nothing for a complete, reconciled block', () => {
    expect(render({ summary: fromQuality(quality) })).toBe('');
  });

  it.each([
    [{ complete: false }, 'incomplete', 'qnote gapn'],
    [{ operationsComplete: false }, 'operations-incomplete', 'qnote gapn'],
    [{ unreconciledDays: ['2026-10-09'] }, 'unreconciled', 'qnote"'],
    [{ unpairedEvents: 2 }, 'unpaired', 'qnote unpairedn'],
  ])('maps %j to the %s note', (change, flag, className) => {
    const html = render({ summary: fromQuality({ ...quality, ...change }) });
    expect(html).toContain(`data-flag="${flag}"`);
    expect(html).toContain(`class="${className}`);
  });

  it('keeps the wording of the flags', () => {
    const html = render({ summary: fromQuality({ ...quality, unreconciledDays: ['2026-10-09'] }), points: true });
    expect(html).toContain(texts.quality.unreconciled(['Oct 9']));
    expect(html).toContain(texts.quality.unreconciledPoints);
  });

  it('shows a delayed note first, with the caller’s text', () => {
    const html = render({ summary: merge([fromQuality({ ...quality, complete: false })]), delayed: 'Base is behind' });
    expect(html.indexOf('data-flag="delayed"')).toBeLessThan(html.indexOf('data-flag="incomplete"'));
    expect(html).toContain('<p>Base is behind</p>');
    expect(render({ summary: fromQuality(quality), delayed: 'Base is behind' })).toContain('qnote delayed');
  });
});
