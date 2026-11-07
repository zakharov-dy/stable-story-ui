import { texts } from '../texts.ts';
import { disabledPeriods, historyDays } from '@app/view';
import { defaultPeriod, PERIOD_ORDER } from '../view.ts';
import type { Overview } from '@app/contracts';

/** Native radios drive the server-rendered views through CSS, including without JavaScript. */
export function PeriodSwitch({ overview }: { overview: Overview }) {
  const off = new Set(disabledPeriods(historyDays(overview)));
  const initial = defaultPeriod(overview);
  return (
    <fieldset className="seg" id="period">
      <legend className="sr">{texts.period.legend}</legend>
      {PERIOD_ORDER.map((period) => (
        <label key={period}>
          <input
            type="radio"
            name="period"
            value={period}
            defaultChecked={period === initial}
            disabled={off.has(period) || overview.views[period] === null}
          />
          <span>{texts.period.options[period]}</span>
        </label>
      ))}
    </fieldset>
  );
}
