import { texts } from '../texts.ts';
import { disabledPeriods, historyDays, PERIODS } from '@app/view';
import type { Overview } from '@app/contracts';

/** Native radios drive the server-rendered views through CSS, including without JavaScript. */
export function PeriodSwitch({ overview }: { overview: Overview }) {
  const off = new Set(disabledPeriods(historyDays(overview)));
  return (
    <fieldset className="seg" id="period">
      <legend className="sr">{texts.period.legend}</legend>
      {PERIODS.map((period) => (
        <label key={period}>
          <input
            type="radio"
            name="period"
            value={period}
            defaultChecked={period === '30d'}
            disabled={off.has(period) || overview.views[period] === null}
          />
          <span>{texts.period.options[period]}</span>
        </label>
      ))}
    </fieldset>
  );
}
