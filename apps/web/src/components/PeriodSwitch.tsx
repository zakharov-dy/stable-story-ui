// The page-wide period switch: one `fieldset` of three radios above section 03, a server component
// with no client JS. A radio group gives keyboard and no-JS behaviour for free; CSS shows the section
// copy the checked radio names. The caption names the driven sections from `texts.period.driven`.
import { texts } from '../texts.ts';
import { disabledPeriods, PERIODS, type PeriodId } from '@app/view';

/** One switch for the chart block, default 30D; short histories disable the longer periods. */
export function PeriodSwitch({ days }: { days: number }) {
  const off: ReadonlySet<PeriodId> = new Set(disabledPeriods(days));
  const note = off.has('90d') ? texts.period.shortNote : off.has('all') ? texts.period.allNote : null;
  const caption = [texts.period.caption(texts.period.driven), note].filter(Boolean).join(' ');
  return (
    <>
      <div className="pbar">
        <div className="pb-l">
          <span className="label"><span className="ix">///</span>{texts.period.label}</span>
          <p>{caption}</p>
        </div>
        <fieldset className="seg" id="period">
          <legend>{texts.period.legend}</legend>
          {PERIODS.map((period) => (
            <label key={period}>
              <input type="radio" name="period" value={period} defaultChecked={period === '30d'} disabled={off.has(period)} />
              <span>{texts.period.options[period]}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <p className="resolution-note">{texts.resolution.sentence}</p>
    </>
  );
}
