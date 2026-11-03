// Chain names and colour slots come from `overview.chains` (enabled configuration order), never a
// hard-coded list: the mock has three chains, the first live milestone one.
import type { Overview } from '@app/contracts';

export interface ChainInfo {
  slug: string;
  name: string;
  index: number; // 1-based position in overview.chains: the --color-chain-N slot
}

export type Chains = Overview['chains'];

export function chainInfo(chains: Chains, slug: string): ChainInfo {
  const position = chains.findIndex((chain) => chain.slug === slug);
  const chain = chains[position];
  return chain ? { slug, name: chain.name, index: position + 1 } : { slug, name: slug, index: 0 };
}
