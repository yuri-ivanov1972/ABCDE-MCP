import type { PublicStats } from '@workspace/api-client-react';
import { contentNamespace, sitePath } from './site-config';

// The hosting project forwards only this scoped route, not its own /api namespace.
export async function fetchIntegratedStats(base: string, signal?: AbortSignal): Promise<PublicStats> {
  const response = await fetch(sitePath(base, `${contentNamespace}stats`), {
    signal, credentials: 'omit', headers: { Accept: 'application/json' },
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Statistics unavailable');
  }
  const stats = await response.json();
  if (!Number.isSafeInteger(stats?.toolCalls) || stats.toolCalls < 0 ||
      !(stats.measuredSessions === null || (Number.isSafeInteger(stats.measuredSessions) && stats.measuredSessions >= 0)) ||
      typeof stats.sessionMeasurementAvailable !== 'boolean') {
    throw new Error('Invalid statistics response');
  }
  return stats;
}
