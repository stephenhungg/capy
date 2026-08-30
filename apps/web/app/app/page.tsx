import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { WorkItemAction } from '@/components/work-item-action';
import { getEvidenceMetrics, percent, roleCopy } from '@/lib/capability-view';
import { probeI2rtIngest } from '@/lib/i2rt-ingest';
import { CAPABILITY_ID } from '@/lib/protocol-fixtures';
import {
  getCapabilityBundle,
  requirePlatformSession,
  resolveRoleLens,
} from '@/lib/platform-data';

export const dynamic = 'force-dynamic';

export default async function WorkQueue({ searchParams }: { searchParams: Promise<{ lens?: string }> }) {
  const requestedLens = (await searchParams).lens;
  const session = await requirePlatformSession(`/app${requestedLens ? `?lens=${requestedLens}` : ''}`);
  const lens = resolveRoleLens(requestedLens, session.membership.role);
  const [bundle, i2rtIngest] = await Promise.all([
    getCapabilityBundle(CAPABILITY_ID, session.organization.id),
    probeI2rtIngest(),
  ]);
  if (!bundle) throw new Error('seeded capability is unavailable');
  const metrics = getEvidenceMetrics();
  const copy = roleCopy[lens];
  const roleWorkItem = bundle.workItems.find((item) => item.requiredRole === lens);
  if (!roleWorkItem) throw new Error(`no work item is configured for ${lens}`);
  const canAct =
    session.membership.role === lens ||
    (session.user.userId === 'local_seedy' && session.user.email.endsWith('@sites.test'));
  const headline =
    roleWorkItem.state === 'pending'
      ? 'one decision needs you'
      : roleWorkItem.state === 'completed'
        ? 'you’re clear'
        : 'waiting on the previous step';

  return (
    <AppShell session={session} lens={lens}>
      <div className="mx-auto max-w-3xl">
        <header>
          <p className="eyebrow">{copy.eyebrow} · synthetic sandbox</p>
          <h1 className="mt-2 text-[clamp(2rem,6vw,3.6rem)] font-bold leading-none tracking-[-0.055em]">
            {headline}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted-ink)]">
            {copy.explanation}
          </p>
        </header>

        <div className="mt-8">
          <WorkItemAction item={roleWorkItem} lens={lens} canAct={canAct} />
        </div>

        <Link
          href={`/app/capabilities/${CAPABILITY_ID}?lens=${lens}`}
          className="mt-4 flex items-center justify-between gap-4 rounded-lg border bg-[var(--card)] p-4 hover:bg-[var(--mint)]"
        >
          <div className="min-w-0">
            <p className="eyebrow">capability</p>
            <h2 className="mt-1 truncate text-sm font-bold">{bundle.capability.title}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--muted-ink)]">
              <span className="inline-flex items-center gap-1"><Check className="size-3" /> {i2rtIngest.status ? `i2rt · ${i2rtIngest.status.sessions.verified} ingested · 0 cameras` : `${metrics.episodes} fixture episodes`}</span>
              <span aria-hidden="true">·</span>
              <span>{percent(metrics.candidateSuccess)} evaluation</span>
              <span aria-hidden="true">·</span>
              <span>{bundle.capability.status.replaceAll('_', ' ')}</span>
            </p>
          </div>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      </div>
    </AppShell>
  );
}
