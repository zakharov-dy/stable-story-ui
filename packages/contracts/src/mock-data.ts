// Shape of the generated, lazily loaded mock index. No runtime imports.
export interface MockIndex {
  states: Record<string, { chains: string[]; assets: string[] }>;
  /** Normalized query key → loader of the response JSON in `fixtures/` (an import with attributes). */
  entries: Record<string, () => Promise<{ default: unknown }>>;
}
