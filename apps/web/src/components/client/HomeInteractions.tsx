'use client';

import { useEffect } from 'react';

/** Progressive enhancement of native controls. Chart data stays on the server. */
export function HomeInteractions() {
  useEffect(() => {
    const hero = document.getElementById('hero');
    const sticky = document.getElementById('sticky-bar');
    const supply = document.querySelector<HTMLElement>('.supply-layout');
    const observer = new IntersectionObserver(([entry]) => {
      if (sticky !== null && entry !== undefined) {
        const visible =
          !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
        sticky.hidden = !visible;
      }
    });
    if (hero !== null) observer.observe(hero);

    const sync = () => {
      const selected = document.querySelector<HTMLInputElement>(
        'input[name="period"]:checked',
      );
      for (const button of document.querySelectorAll<HTMLButtonElement>(
        '[data-sticky-period]',
      )) {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.stickyPeriod === selected?.value),
        );
      }
    };
    const click = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      const button = element?.closest<HTMLButtonElement>(
        '[data-sticky-period]',
      );
      if (button !== null && button !== undefined) {
        const radio = document.querySelector<HTMLInputElement>(
          `input[name="period"][value="${button.dataset.stickyPeriod}"]`,
        );
        radio?.click();
      }
      sync();
    };
    const highlight = (event: Event) => {
      const element = event.target instanceof Element ? event.target : null;
      const row = element?.closest<HTMLElement>('.crow');
      if (supply !== null) {
        for (const layer of supply.querySelectorAll<SVGElement>(
          '.chart-layer',
        )) {
          layer.classList.toggle(
            'dimmed',
            row !== null &&
              row !== undefined &&
              layer.dataset.chainIndex !== row.dataset.chainIndex,
          );
        }
      }
    };
    const reset = () => {
      supply
        ?.querySelectorAll('.dimmed')
        .forEach((layer) => layer.classList.remove('dimmed'));
    };
    document.addEventListener('click', click);
    document.addEventListener('change', sync);
    supply?.addEventListener('pointerover', highlight);
    supply?.addEventListener('focusin', highlight);
    supply?.addEventListener('pointerleave', reset);
    supply?.addEventListener('focusout', reset);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('click', click);
      document.removeEventListener('change', sync);
      supply?.removeEventListener('pointerover', highlight);
      supply?.removeEventListener('focusin', highlight);
      supply?.removeEventListener('pointerleave', reset);
      supply?.removeEventListener('focusout', reset);
    };
  }, []);
  return null;
}
