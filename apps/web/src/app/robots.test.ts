import type { MetadataRoute } from 'next';
import { describe, expect, it } from 'vitest';
import robots from './robots.ts';

// One rule of the robots file, as Next types it (no exported member: structural copy).
interface RobotRule {
  userAgent?: string | string[] | undefined;
  allow?: string | string[] | undefined;
  disallow?: string | string[] | undefined;
}

const asList = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const asRules = (spec: MetadataRoute.Robots): RobotRule[] =>
  Array.isArray(spec.rules) ? spec.rules : [spec.rules];

const coversAllAgents = (rule: RobotRule): boolean => asList(rule.userAgent).includes('*');

describe('robots', () => {
  it('allows every agent everywhere and emits no sitemap', () => {
    const spec = robots();
    // There is no sitemap, so no sitemap line may be emitted.
    expect(spec.sitemap).toBeUndefined();
    const wildcard = asRules(spec).filter(coversAllAgents);
    expect(wildcard.length).toBeGreaterThan(0);
    for (const rule of wildcard) {
      // The page is public: nothing may be disallowed for all agents.
      expect(asList(rule.disallow)).toEqual([]);
      expect(asList(rule.allow)).toContain('/');
    }
  });
});
