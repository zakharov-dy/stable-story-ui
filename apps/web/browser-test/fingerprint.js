/* eslint-disable -- runs inside the browser page (browser-test/README.md); the script embeds only the function below */
(hooks) => {
  // Structure and style fingerprint of a page or of a design mockup (apps/web/browser-test/README.md).
  // Run it the same way on both, with no argument. First run (empty window.name): it stores the
  // fingerprint of the page in window.name and returns a short receipt. Second run, in the same tab
  // after navigating to the mockup: it fingerprints the mockup, compares it with the stored page
  // fingerprint, clears window.name and returns the differences. Numbers in texts are masked; the
  // values of cards and charts are not part of it. Pixel values closer than 2 px are equal.
  const PREFIX = '__bt-fingerprint:';
  const TOLERANCE_PX = 2;
  const LIMIT = 200;
  const TEXT_SELECTOR = 'h1,h2,.label,.sec-h > p,.legend > *,.tag,.chip,.key,.na-why,.rec-reason,.demo';
  const FIGURES = '.chip-v,.chip-f,.kpi-value,.full,.chg,.frac,.sfx,[data-tone]';
  // The first card that is not in a delayed or unreconciled state: the mockups of those states draw their own card first.
  const CARD_SELECTOR = '.card:not([data-delayed]):not([data-unreconciled]):not([data-chain-state="delayed"]):not([data-chain-state="unreconciled"])';
  // Targets whose presence depends on the data or on the markup, not on the design: only their styles are compared, when both sides have one.
  const DATA_TARGETS = new Set(['tag.cctp', 'tag.unrec', 'tag.delayed', 'tag.nodata', 'tag.peer', 'tag.unpaired', 'chain', 'chip', 'qnote', 'card', 'link', 'th', 'td']);
  const TARGETS = [
    ['sec-label', '.sec-h .label'],
    ['sec-ix', '.sec-h .ix'],
    ['sec-title', '.sec-h h2'],
    ['sec-caption', '.sec-h > p'],
    ['kpi-card', '[data-kpi]'],
    ['kpi-value', '.kpi, .rec-kpi'],
    ['kpi-full', '.full, .rec-full'],
    ['kpi-change', '.chg'],
    ['card', CARD_SELECTOR],
    ['chain', '.chain'],
    ['th', 'th'],
    ['td', 'td'],
    ['chip', '.chip'],
    ['tag.cctp', '.tag.cctp'],
    ['tag.unrec', '.tag.unrec'],
    ['tag.delayed', '.tag.delayed'],
    ['tag.nodata', '.tag.nodata'],
    ['tag.peer', '.tag.peer'],
    ['tag.unpaired', '.tag.unpaired'],
    ['qnote', '.qnote'],
    ['legend', '.legend'],
    ['link', 'a'],
  ];
  const PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'color', 'backgroundColor', 'padding', 'margin', 'gap', 'border', 'borderRadius'];
  const PX_SCALARS = ['x', 'width'];
  const COUNTS = ['columns', 'charts', 'sparks', 'legendItems'];
  const MARKS = ['kpi'];

  const maskText = (text) =>
    String(text)
      .replace(/\s+/g, ' ')
      .replace(/[\u2019\u2018]/g, "'")
      .trim()
      .replace(/\d+(?:[.,_']\d+)*(?:[KMBT](?![A-Za-z]))?/g, '#')
      .replace(/[+\-\u2212\u2013\u25b2\u25bc]\s?#/g, '#');
  const labelOf = (node) => {
    const clone = node.cloneNode(true);
    for (const figure of clone.querySelectorAll(FIGURES)) figure.remove();
    return clone.textContent || '';
  };
  const show = (value) => String(value).replace(/(\d+\.\d{2})\d+/g, '$1'); // for the evidence only: the comparison keeps every digit
  const normalizeValue = (prop, value) => {
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (prop === 'fontFamily') return (text.split(',')[0] || '').replace(/["']/g, '').trim().toLowerCase();
    return text;
  };
  const isPx = (token) => /^-?\d+(\.\d+)?px$/.test(token);
  const sameValue = (a, b) => {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < TOLERANCE_PX;
    const left = String(a).split(' ');
    const right = String(b).split(' ');
    if (left.length !== right.length) return false;
    return left.every((token, index) => token === right[index] || (isPx(token) && isPx(right[index]) && Math.abs(parseFloat(token) - parseFloat(right[index])) < TOLERANCE_PX));
  };

  const normalize = (raw) => {
    const seen = {};
    const blocks = {};
    const order = [];
    for (const block of raw.blocks) {
      seen[block.name] = (seen[block.name] || 0) + 1;
      const name = seen[block.name] === 1 ? block.name : block.name + '#' + seen[block.name];
      const styles = {};
      for (const target of Object.keys(block.styles)) {
        styles[target] = {};
        for (const prop of PROPS) styles[target][prop] = normalizeValue(prop, block.styles[target][prop]);
      }
      blocks[name] = {
        x: block.x,
        width: block.width,
        columns: block.columns,
        charts: block.charts,
        sparks: block.sparks,
        legendItems: block.legendItems,
        marks: { kpi: block.marks.kpi },
        texts: block.texts.map(maskText).filter(Boolean),
        styles,
      };
      order.push(name);
    }
    return { viewport: { w: raw.viewport.w, h: raw.viewport.h }, order, blocks };
  };

  const diff = (design, page) => {
    const out = [];
    const add = (block, property, designValue, pageValue) => out.push({ block, property, design: show(designValue), page: show(pageValue) });
    const common = design.order.filter((name) => name in page.blocks);
    const notInMockup = page.order.filter((name) => !(name in design.blocks));
    for (const name of design.order) if (!(name in page.blocks)) add(name, 'presence', 'present', 'absent');
    for (const name of notInMockup) add(name, 'presence', 'absent', 'present');
    const pageCommon = page.order.filter((name) => name in design.blocks);
    if (common.join(',') !== pageCommon.join(',')) add('-', 'order', common.join(','), pageCommon.join(','));
    for (const name of common) {
      const d = design.blocks[name];
      const p = page.blocks[name];
      for (const key of PX_SCALARS) if (!sameValue(d[key], p[key])) add(name, key, d[key] + 'px', p[key] + 'px');
      for (const key of COUNTS) if (d[key] !== p[key]) add(name, key, d[key], p[key]);
      for (const key of MARKS) if (d.marks[key] !== p.marks[key]) add(name, 'marks.' + key, d.marks[key], p.marks[key]);
      const inPage = p.texts.slice();
      const onlyDesign = [];
      for (const text of d.texts) {
        const at = inPage.indexOf(text);
        if (at === -1) onlyDesign.push(text);
        else inPage.splice(at, 1);
      }
      if (onlyDesign.length > 0 || inPage.length > 0) add(name, 'texts', onlyDesign.join(' | ') || '-', inPage.join(' | ') || '-');
      for (const target of Object.keys(d.styles)) {
        if (!(target in p.styles)) {
          if (!DATA_TARGETS.has(target)) add(name, 'styles.' + target, 'present', 'absent');
          continue;
        }
        for (const prop of PROPS) if (!sameValue(d.styles[target][prop], p.styles[target][prop])) add(name, target + '.' + prop, d.styles[target][prop], p.styles[target][prop]);
      }
    }
    return { diffs: out.slice(0, LIMIT), total: out.length, notInMockup };
  };

  const collect = () => {
    const styleOf = (el) => {
      const cs = getComputedStyle(el);
      const four = (a, b, c, d) => [cs[a], cs[b], cs[c], cs[d]].join(' ');
      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        padding: four('paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'),
        margin: four('marginTop', 'marginRight', 'marginBottom', 'marginLeft'),
        gap: cs.rowGap + ' ' + cs.columnGap,
        border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
        borderRadius: cs.borderTopLeftRadius,
      };
    };
    const blocks = [...document.querySelectorAll('[data-block]')].map((el) => {
      let name = el.getAttribute('data-block');
      if (name === 'drivers' && el.classList.contains('ab-eq')) name = 'day-equation';
      if (name === 'no-figures') name = 'header'; // the empty page names its header block so; the mockup calls it header
      const rect = el.getBoundingClientRect();
      const styles = { root: styleOf(el) };
      for (const [target, selector] of TARGETS) {
        const found = el.querySelector(selector);
        if (!found) continue;
        styles[target] = styleOf(found);
        if (target === 'qnote') styles[target].margin = styleOf(found.closest('.qnotes') || found).margin; // the page wraps the notices in ul.qnotes and puts the gap there
      }
      let columns = 0;
      for (const node of [el, ...el.querySelectorAll('*')]) {
        if (node.matches('.qnotes')) continue;
        const cs = getComputedStyle(node);
        if (cs.display === 'grid' || cs.display === 'inline-grid') {
          columns = cs.gridTemplateColumns === 'none' ? 0 : cs.gridTemplateColumns.split(' ').filter(Boolean).length;
          break;
        }
      }
      let charts = 0;
      let sparks = 0;
      for (const svg of el.querySelectorAll('svg')) {
        const box = svg.getBoundingClientRect();
        if (box.width >= 120 && box.height >= 60) charts += 1;
        else if (box.width > 0 && box.height > 0) sparks += 1;
      }
      return {
        name,
        x: rect.x + window.scrollX,
        width: rect.width,
        columns,
        charts,
        sparks,
        legendItems: el.querySelectorAll('.legend > *').length,
        marks: { kpi: el.querySelectorAll('[data-kpi]').length },
        texts: [...el.querySelectorAll(TEXT_SELECTOR)].map(labelOf).slice(0, 80),
        styles,
      };
    });
    return { viewport: { w: window.innerWidth, h: window.innerHeight }, blocks };
  };

  if (hooks && hooks.expose) return { maskText, normalizeValue, sameValue, normalize, diff, PROPS, LIMIT, TEXT_SELECTOR, TARGETS, MARKS, COUNTS, PX_SCALARS };
  const env = (hooks && hooks.env) || {
    collect,
    getName: () => window.name,
    setName: (value) => {
      window.name = value;
    },
  };
  const here = normalize(env.collect());
  const stored = env.getName();
  if (typeof stored !== 'string' || !stored.startsWith(PREFIX)) {
    env.setName(PREFIX + JSON.stringify(here));
    return { mode: 'stored', blocks: here.order, viewport: here.viewport };
  }
  const page = JSON.parse(stored.slice(PREFIX.length));
  env.setName('');
  if (page.viewport.w !== here.viewport.w) return { mode: 'error', error: 'viewport width differs: page ' + page.viewport.w + ', mockup ' + here.viewport.w };
  const result = diff(here, page);
  return { mode: 'compared', mockupBlocks: here.order, pageBlocks: page.order, notInMockup: result.notInMockup, total: result.total, diffs: result.diffs };
}
