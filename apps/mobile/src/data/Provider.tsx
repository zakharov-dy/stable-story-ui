import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@app/contracts';
import { createLiveClient } from './client.ts';
import { resolveConfig } from './config.ts';
import { createQueryClient } from './policy.ts';
import { queryKeys } from './keys.ts';
import { createDevelopmentClient, DevelopmentControls } from './dev/index.tsx';

const ClientContext = createContext<ApiClient | null>(null);

export function DataProvider({ children, client }: { children: ReactNode; client?: ApiClient }) {
  const [config] = useState(() => resolveConfig(Constants.expoConfig?.extra, Platform.OS, __DEV__));
  const [runtime, setRuntime] = useState(() => ({
    client: client ?? (__DEV__ ? createDevelopmentClient(config) : createLiveClient(config)),
    queries: createQueryClient(),
    revision: 0,
  }));
  useEffect(() => () => { runtime.queries.clear(); }, [runtime.queries]);
  const replaceClient = (next: ApiClient): void => {
    // A fresh cache isolates responses from cancelled requests of the previous scenario.
    void runtime.queries.cancelQueries();
    runtime.queries.clear();
    setRuntime({ client: next, queries: createQueryClient(), revision: runtime.revision + 1 });
  };
  return <><QueryClientProvider key={runtime.revision} client={runtime.queries}>
    <ClientContext value={runtime.client}>{children}</ClientContext>
  </QueryClientProvider>
  {__DEV__ && !client ? <DevelopmentControls config={config} replaceClient={replaceClient} /> : null}</>;
}

export function useOverview(asset = 'usdc') {
  const client = useContext(ClientContext);
  if (!client) throw new Error('useOverview requires DataProvider');
  return useQuery({ queryKey: queryKeys.overview(asset), queryFn: ({ signal }) => client.overview({ asset }, { signal }) });
}
