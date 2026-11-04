import { texts } from '../texts.ts';

export function HowWeCount() {
  return (
    <section
      className="block method"
      data-block="how-we-count"
      aria-labelledby="h-how"
    >
      <h2 id="h-how">{texts.howWeCount.title}</h2>
      <div className="method-text">
        <p>{texts.howWeCount.body}</p>
        <p>{texts.howWeCount.bridge}</p>
        <p className="disclaimer" data-block="disclaimer">
          {texts.disclaimer.body}
        </p>
      </div>
    </section>
  );
}
