import { env } from 'cloudflare:workers';

import { probeI2rtIngest } from '@/lib/i2rt-ingest';

export type DependencyProbe = {
  state: 'ready' | 'degraded';
  detail: string;
};

export type PlatformReadiness = {
  ready: boolean;
  checkedAt: string;
  d1: DependencyProbe;
  r2: DependencyProbe;
  executor: {
    state: 'idle' | 'queued' | 'degraded';
    queuedHandoffs: number;
    detail: string;
  };
  edgeIngest: {
    state: 'ready' | 'degraded' | 'not_connected';
    detail: string;
  };
};

export async function probePlatformReadiness(): Promise<PlatformReadiness> {
  const edgeIngestPromise = probeI2rtIngest();
  let d1: DependencyProbe;
  let queuedHandoffs = 0;
  try {
    const probe = await env.DB.prepare('select 1 as ok').first<{ ok: number }>();
    if (probe?.ok !== 1) throw new Error('unexpected database probe response');
    const queue = await env.DB.prepare(
      "select count(*) as count from executor_handoffs where state = 'queued'",
    ).first<{ count: number }>();
    queuedHandoffs = Number(queue?.count ?? 0);
    d1 = { state: 'ready', detail: 'durable projections reachable' };
  } catch (error) {
    d1 = {
      state: 'degraded',
      detail:
        error instanceof Error ? error.message : 'database probe failed',
    };
  }

  let r2: DependencyProbe;
  try {
    await env.FILES.list({ limit: 1 });
    r2 = { state: 'ready', detail: 'immutable object store reachable' };
  } catch (error) {
    r2 = {
      state: 'degraded',
      detail:
        error instanceof Error ? error.message : 'object-store probe failed',
    };
  }

  const ready = d1.state === 'ready' && r2.state === 'ready';
  const edgeIngest = await edgeIngestPromise;
  return {
    ready,
    checkedAt: new Date().toISOString(),
    d1,
    r2,
    executor: {
      state: d1.state === 'degraded' ? 'degraded' : queuedHandoffs > 0 ? 'queued' : 'idle',
      queuedHandoffs,
      detail:
        queuedHandoffs > 0
          ? 'authorized handoffs await an isolated Solana worker'
          : 'no authorized handoff is waiting',
    },
    edgeIngest: { state: edgeIngest.state, detail: edgeIngest.detail },
  };
}
