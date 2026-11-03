/** The product mark: two overlapping squares. Decorative, so hidden from assistive technology. */
export function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect className="mark-outline" x="1.5" y="1.5" width="11" height="11" rx="2" />
      <rect className="mark-fill" x="8" y="8" width="10.5" height="10.5" rx="2" />
    </svg>
  );
}
