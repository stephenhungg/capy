import { Cable, Check, Database, HardDrive, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { probePlatformReadiness } from '@/lib/readiness';

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const readiness = await probePlatformReadiness();
  const services = [
    { name: 'control plane', detail: 'auth + role projections available', icon: ShieldCheck, state: 'ready' },
    { name: 'object index', detail: readiness.d1.detail, icon: Database, state: readiness.d1.state },
    { name: 'artifact resolver', detail: readiness.r2.detail, icon: HardDrive, state: readiness.r2.state },
    { name: 'edge ingest', detail: readiness.edgeIngest.detail, icon: Cable, state: readiness.edgeIngest.state },
    { name: 'payout executor', detail: `${readiness.executor.detail} · mainnet disabled`, icon: Check, state: readiness.executor.state },
  ];
  return (
    <main className="min-h-screen px-4 py-5 sm:px-7">
      <header className="mx-auto flex max-w-[860px] items-center justify-between border-b pb-4">
        <Link href="/" className="wordmark text-[1.8rem]">capy</Link>
        <Link href="/app" className="rounded-md border border-[var(--ink)] px-3 py-2 text-xs font-bold">open app</Link>
      </header>
      <section className="mx-auto mt-12 max-w-[860px]">
        <p className="eyebrow">system status</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em]">
          {readiness.ready ? 'control plane is ready' : 'control plane is degraded'}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted-ink)]">the web control plane is available. physical I2RT execution remains local and is never controlled from this service.</p>
        <div className="surface mt-8 divide-y overflow-hidden">
          {services.map(({ name, detail, icon: Icon, state }) => (
            <div key={name} className="grid gap-3 p-4 sm:grid-cols-[34px_1fr_auto] sm:items-center sm:px-5">
              <div className="grid size-8 place-items-center rounded-md border bg-[var(--mint)]"><Icon className="size-3.5" /></div>
              <div><p className="text-xs font-bold">{name}</p><p className="mono mt-1 text-[9px] text-[var(--muted-ink)]">{detail}</p></div>
              <span className={`flex items-center gap-1.5 text-[10px] font-bold ${state === 'ready' || state === 'idle' ? 'text-[#22735f]' : 'text-[#8a4b0f]'}`}><span className="status-dot" /> {state.replaceAll('_', ' ')}</span>
            </div>
          ))}
        </div>
        <p className="mono mt-3 text-[9px] text-[var(--muted-ink)]">checked {readiness.checkedAt}</p>
        <p className="mt-5 text-[10px] leading-4 text-[var(--muted-ink)]">this status page reports the synthetic sandbox path. no claim is made about a connected physical robot, hardware capture, or mainnet settlement.</p>
      </section>
    </main>
  );
}
