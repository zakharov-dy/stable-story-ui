'use client';

// The only client component: after hydration it shows the tooltip of the column under the pointer or
// under the keyboard focus. A chart without structured data keeps the plain-string card; a migrated
// chart gets the server-formatted card with rows, plus the crosshair, the ring and the date chip.
//
// No-JS path: the server render holds the SVG root <title> and one <title> per column. In the
// structured mode the first effect drops every one of them, the root label title included (browsers
// can show that as a native tooltip too), so the card is the only tooltip; the accessible names stay
// on the chart's aria-label and on the focusable plot. The plain path (drivers, sparklines) never
// reads `hydrated` and keeps its titles and behaviour.
//
// It gets ready-made strings and the server-rendered marks through props; it imports nothing but
// React and never fetches.
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode, RefObject } from 'react';
import { Fragment } from 'react';
import type { ChartMarker, TooltipColumn, TooltipMarker } from '@app/view';

export const TOOLTIP_WIDTH = 248; // px, .chart-tooltip in charts.css
export const TOOLTIP_GAP = 18; // px from the column centre to the card

/** A plot that shows one tooltip at a time together with the other plots of the page. */
export interface HoverMember {
  hide: () => void;
}

/**
 * The plots of a page hide each other's tooltip: a pointer in one plot takes the card from a plot
 * that still holds keyboard focus, so exactly one card is visible. It is a module-level object of
 * this client module, not a provider, because the two panels of the supply chart are siblings
 * rendered by a server component.
 */
export interface HoverGroup {
  join: (member: HoverMember) => () => void;
  claim: (member: HoverMember) => void;
}

export function createHoverGroup(): HoverGroup {
  const members = new Set<HoverMember>();
  return {
    join: (member) => {
      members.add(member);
      return () => {
        members.delete(member);
      };
    },
    claim: (member) => {
      for (const other of members) if (other !== member) other.hide();
    },
  };
}

// Every chart of the page shares one tooltip.
const pageHovers = createHoverGroup();

export interface Hit {
  x: string;
  width: string;
}

/** Plot box as fractions of the chart: left/right of the width, top/bottom of the height. */
export interface Plot {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const percent = (fraction: number): string => `${Math.round(fraction * 10000) / 100}%`;

/** The column under a pointer position (a fraction of the chart width), or null outside the plot. */
export function columnAt(position: number, columns: number, left: number, right: number): number | null {
  if (columns <= 0 || right <= left) return null;
  const index = Math.floor(((position - left) / (right - left)) * columns);
  return index >= 0 && index < columns ? index : null;
}

/** The keys the plot handles. */
export function isStepKey(key: string): boolean {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End' || key === 'Escape';
}

/**
 * The column after a key: ← → move one column (the first press selects the first column), Home and
 * End jump to the ends, Escape hides the tooltip. Other keys leave the selection unchanged.
 */
export function stepColumn(active: number | null, key: string, columns: number): number | null {
  if (columns <= 0) return null;
  switch (key) {
    case 'Escape':
      return null;
    case 'Home':
      return 0;
    case 'End':
      return columns - 1;
    case 'ArrowLeft':
      return active === null ? 0 : Math.max(0, active - 1);
    case 'ArrowRight':
      return active === null ? 0 : Math.min(columns - 1, active + 1);
    default:
      return active;
  }
}

/** The card's left edge: 18 px right of the column, flipped left at the plot's right edge and kept inside it. */
export function placeCard(center: number, cardWidth: number, gap: number, plotLeft: number, plotRight: number): { left: number; flipped: boolean } {
  const right = center + gap;
  if (right + cardWidth <= plotRight) return { left: right, flipped: false };
  return { left: Math.max(plotLeft, center - gap - cardWidth), flipped: true };
}

/** The chip centre, clamped so the whole pill stays inside the plot (or centred on a plot narrower than it). */
export function clampChip(center: number, chipWidth: number, plotLeft: number, plotRight: number): number {
  if (plotRight - plotLeft <= chipWidth) return (plotLeft + plotRight) / 2;
  return Math.min(plotRight - chipWidth / 2, Math.max(plotLeft + chipWidth / 2, center));
}

const columnCenter = (index: number, columns: number, left: number, right: number): number =>
  left + ((index + 0.5) / Math.max(1, columns)) * (right - left);

/** The marker span class of a tooltip row: a chain dot by default, a flow square or bar for section 04. */
function markerClass(marker: TooltipMarker | undefined): string {
  switch (marker) {
    case 'solid-square':
      return 'tt-sq';
    case 'hatched-square':
      return 'tt-sq-hatched';
    case 'bar':
      return 'tt-bar';
    default:
      return 'tt-dot';
  }
}

/** What a plot shows: the active column and whether it holds keyboard focus. */
export interface HoverState {
  active: number | null;
  focused: boolean;
  pinned?: boolean;
}

export const HOVER_IDLE: HoverState = { active: null, focused: false };

/** A plot in the page's hover group, or null before its effect has joined. */
export interface HoverClaim {
  group: HoverGroup;
  member: HoverMember;
}

/**
 * Take the page's single card for this plot. The handlers call it before they change their own
 * state, never inside a setState updater: an updater must stay pure, and hiding another plot is a
 * side effect. A pointer entering the share panel thus hides the level panel's card while the level
 * panel still holds keyboard focus, so only one card is visible.
 */
export function claimPage(claim: HoverClaim | null): void {
  claim?.group.claim(claim.member);
}

/** The transitions of the handlers, pure so both panels can be exercised without a DOM. */
export function pointerMoved(state: HoverState, active: number | null): HoverState {
  return state.pinned === true ? state : { ...state, active };
}

/** Leaving with the pointer keeps a focused card; without focus the card hides. */
export function pointerLeft(state: HoverState): HoverState {
  return state.focused || state.pinned === true ? state : { ...state, active: null };
}

/** Focus shows the first column if nothing is shown yet. */
export function plotFocused(state: HoverState, columns: number): HoverState {
  return { ...state, active: state.active ?? (columns > 0 ? 0 : null), focused: true };
}

export function plotBlurred(state: HoverState): HoverState {
  return state.pinned === true ? { ...state, focused: false } : { ...state, active: null, focused: false };
}

/** Arrow keys and Home/End step the card; Escape only hides this plot's own card. */
export function plotKeyed(state: HoverState, key: string, columns: number): HoverState {
  return key === 'Escape' ? { active: null, focused: state.focused } : { ...state, active: stepColumn(state.active, key, columns) };
}

export function pinColumn(state: HoverState, active: number): HoverState {
  return { ...state, active, pinned: true };
}

export interface ChartHoverProps {
  tips: readonly string[]; // one plain string per column, already formatted
  tooltips?: readonly TooltipColumn[]; // structured content, same length as tips
  announcements?: readonly string[]; // what the live region says per column; defaults to tips
  markers?: readonly (readonly ChartMarker[])[];
  frameClass?: string;
  yAxis?: ReactNode;
  xAxis?: ReactNode;
  aside?: ReactNode;
  pinOnTouch?: boolean;
  closeLabel?: string;
  label: string;
  stretch?: boolean;
  squeeze?: boolean;
  viewBox: string;
  hits: readonly Hit[];
  hit: { top: number; height: number };
  plot: Plot;
  overlay?: ReactNode;
  children: ReactNode;
}

export interface ChartHoverViewProps extends ChartHoverProps {
  hydrated: boolean;
  active: number | null;
  width: number; // measured chart width in px, 0 before the first measurement
  chipWidth: number; // measured date chip width in px
  pinned?: boolean;
  onClose?: () => void;
  containerRef?: RefObject<HTMLDivElement | null>;
  chipRef?: RefObject<HTMLSpanElement | null>;
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * The pure view of the hover, so both hydration states are renderable without a DOM. `hydrated`
 * false is the no-JS markup; the titles disappear only in the structured mode after hydration.
 */
export function ChartHoverView(props: ChartHoverViewProps) {
  const {
    tips, tooltips, announcements, markers, label, stretch = false, squeeze = false, viewBox, hits, hit, plot, overlay, children,
    hydrated, active, width, chipWidth, containerRef, chipRef, frameClass = 'chart-frame',
    yAxis, xAxis, aside, pinOnTouch, closeLabel, pinned = false, onClose, onKeyDown, ...handlers
  } = props;
  const structured = tooltips !== undefined;
  const titles = !structured || !hydrated;
  const center = active === null ? 0 : columnCenter(active, tips.length, plot.left, plot.right);
  const column = tooltips !== undefined && active !== null ? tooltips[active] : undefined;
  const tip = active === null ? undefined : tips[active];
  const placement = column === undefined ? undefined : placeCard(center * width, TOOLTIP_WIDTH, TOOLTIP_GAP, plot.left * width, plot.right * width);
  const chipLeft = column === undefined ? 0 : clampChip(center * width, chipWidth, plot.left * width, plot.right * width);
  const rings = column === undefined || active === null ? [] : (markers?.[active] ?? []);
  const card = column === undefined ? null : (
    <div
      className="chart-tip chart-tooltip"
      data-pinned={pinned ? 'true' : undefined}
      data-tooltip="structured"
      aria-hidden={pinned ? undefined : true}
      data-side={placement?.flipped === true ? 'left' : 'right'}
      style={pinned ? undefined : { left: placement?.left ?? 0, top: `calc(${percent(plot.top)} + var(--space-3))` }}
    >
      {pinned ? <button type="button" className="chart-tooltip-close" onClick={onClose} aria-label={closeLabel}>×</button> : null}
      {column.hideHeader === true ? null : <div className="chart-tooltip-head">
        {column.header.marker === 'none'
          ? <span className="tt-line" data-hidden="true" aria-hidden="true" />
          : <span className="tt-line" aria-hidden="true" />}
        <span className="tt-label">{column.header.label}</span>
        {column.header.value === undefined ? null : <span className="tt-value">{column.header.value}</span>}
        {column.header.share === undefined ? null : <span className="tt-share">{column.header.share}</span>}
      </div>}
      {column.rows.map((row, index) => (
        <Fragment key={`${row.label}-${String(index)}`}>
          {column.splitBefore === index ? <div className="tt-split" aria-hidden="true" /> : null}
          <div
            className="chart-tooltip-row"
            data-chain-index={row.chain === undefined || row.chain === 0 ? undefined : row.chain}
            data-flow={row.flow}
          >
            <span className={markerClass(row.marker)} data-flow={row.flow} aria-hidden="true" />
            <span className="tt-label">{row.label}</span>
            <span className="tt-value">{row.value}</span>
            <span className="tt-share">{row.share ?? ''}</span>
          </div>
        </Fragment>
      ))}
      {column.note === undefined ? null : (
        <div className="chart-tooltip-note" data-tone={column.note.tone}>{column.note.text}</div>
      )}
      <div className="chart-tooltip-foot">
        <span>{column.footer.label}</span>
        <span>{column.footer.value}</span>
      </div>
    </div>
  );
  return (
    <div className={frameClass} data-pinned={pinned ? 'true' : undefined} onKeyDown={onKeyDown}>
      {pinned ? card : null}
      {yAxis}
      <div
        className="chart-hover"
        data-mode={structured ? 'structured' : 'plain'}
        data-pin-on-touch={pinOnTouch === true ? 'true' : undefined}
        ref={containerRef}
        {...handlers}
        tabIndex={structured && hydrated ? 0 : undefined}
        role={structured ? 'group' : undefined}
        aria-label={structured ? label : undefined}
      >
        <svg
          className={stretch ? 'chart stretch' : 'chart'}
          viewBox={viewBox}
          preserveAspectRatio={stretch || squeeze ? 'none' : undefined}
          role="img"
          aria-label={label}
        >
          {titles ? <title>{label}</title> : null}
          {children}
          <g className="chart-hits">
            {hits.map((rect, index) => (
              <rect key={index} className="chart-hit" x={rect.x} y={hit.top} width={rect.width} height={hit.height}>
                {titles ? <title>{tips[index]}</title> : null}
              </rect>
            ))}
          </g>
        </svg>
        {overlay}
        {structured && column !== undefined && active !== null ? (
          <>
            <span
              className="chart-crosshair"
              aria-hidden="true"
              style={{ left: percent(center), top: percent(plot.top), height: percent(plot.bottom - plot.top) }}
            />
            {rings.map((marker, index) => <span key={index} className="chart-ring" data-chain-index={marker.chain} data-flow={marker.flow} aria-hidden="true" style={{ left: percent(center), top: percent(marker.at) }} />)}
            {pinned ? null : card}
            <span ref={chipRef} className="chart-chip" aria-hidden="true" style={{ left: chipLeft }}>
              {column.footer.label}
            </span>
          </>
        ) : null}
        {structured ? null : tip === undefined || active === null ? null : (
          <div className="chart-tip" data-tooltip="plain" role="status" style={{ left: percent(center) }}>
            {tip}
          </div>
        )}
        {structured ? (
          <div className="chart-live" role="status" aria-live="polite">
            {(active === null ? undefined : announcements?.[active]) ?? tip ?? ''}
          </div>
        ) : null}
      </div>
      {aside}
      {xAxis}
    </div>
  );
}

/**
 * The hydrated hover. It measures the chart and the chip after mount, follows the pointer and the
 * keyboard, and hands everything to the pure view.
 */
export function ChartHover(props: ChartHoverProps) {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<HoverState>(HOVER_IDLE);
  const [width, setWidth] = useState(0);
  const [chipWidth, setChipWidth] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const claim = useRef<HoverClaim | null>(null);
  const structured = props.tooltips !== undefined;
  const { active } = state;

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Join the page's one-tooltip group; the returned function leaves it when the chart unmounts.
  useEffect(() => {
    const member: HoverMember = { hide: () => setState((current) => ({ ...current, active: null, pinned: false })) };
    claim.current = { group: pageHovers, member };
    return pageHovers.join(member);
  }, []);

  useEffect(() => {
    const measure = (): void => {
      const element = container.current;
      if (element !== null) setWidth(element.getBoundingClientRect().width);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // The chip renders only with an active column; its width is needed to clamp it to the plot.
  useEffect(() => {
    const element = chip.current;
    const measured = element === null ? 0 : element.getBoundingClientRect().width;
    if (Math.abs(measured - chipWidth) >= 0.5) setChipWidth(measured);
  });

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || state.pinned === true) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (Math.abs(box.width - width) >= 0.5) setWidth(box.width);
    const y = box.height === 0 ? 0 : (event.clientY - box.top) / box.height;
    const position = y < props.plot.top || y > props.plot.bottom ? -1 : box.width === 0 ? 0 : (event.clientX - box.left) / box.width;
    const active = columnAt(position, props.tips.length, props.plot.left, props.plot.right);
    if (active !== null) claimPage(claim.current);
    setState((current) => pointerMoved(current, active));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!structured || props.pinOnTouch !== true || event.pointerType !== 'touch' || !window.matchMedia('(max-width: 720px)').matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const y = (event.clientY - box.top) / box.height;
    if (y < props.plot.top || y > props.plot.bottom) return;
    const active = columnAt((event.clientX - box.left) / box.width, props.tips.length, props.plot.left, props.plot.right);
    if (active === null) return;
    claimPage(claim.current);
    setState((current) => pinColumn(current, active));
  };

  const onPointerLeave = () => {
    setState(pointerLeft);
  };

  const onFocus = () => {
    const element = container.current;
    if (element !== null) setWidth(element.getBoundingClientRect().width);
    claimPage(claim.current);
    setState((current) => plotFocused(current, props.tips.length));
  };

  const onBlur = () => {
    setState(plotBlurred);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!structured || !isStepKey(event.key)) return;
    event.preventDefault();
    // Escape hides this plot's card only; a step key takes the page's card for this plot.
    if (event.key !== 'Escape') claimPage(claim.current);
    setState((current) => plotKeyed(current, event.key, props.tips.length));
  };

  return (
    <ChartHoverView
      {...props}
      hydrated={hydrated}
      active={active}
      width={width}
      chipWidth={chipWidth}
      containerRef={container}
      chipRef={chip}
      pinned={state.pinned}
      onClose={() => setState(HOVER_IDLE)}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
}
