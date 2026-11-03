import { QueryClient } from '@tanstack/react-query';

// Explicit retry/refresh only. DTOs remain untouched; persistence can wrap this boundary later.
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: {
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    structuralSharing: false,
  } } });
}
