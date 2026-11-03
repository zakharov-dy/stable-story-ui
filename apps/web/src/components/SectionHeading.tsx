import { texts } from '../texts.ts';

/**
 * The head of a page section (`.sec-h`): the `/// 0N` label with the section name, the headline and
 * a caption on the right. The number is the caller's; every string comes from `texts`.
 */
export function SectionHeading({ index, label, title, caption, id }: { index: number; label: string; title: string; caption: string; id?: string }) {
  return (
    <div className="sec-h">
      <div>
        <span className="label">
          <span className="ix">{texts.section.label(index)}</span>
          {label}
        </span>
        <h2 id={id}>{title}</h2>
      </div>
      <p>{caption}</p>
    </div>
  );
}
