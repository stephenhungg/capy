import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { TrustGatePanel } from '@/components/trust-gate-panel';
import { WorkItemAction } from '@/components/work-item-action';
import { getEvidenceMetrics, percent } from '@/lib/capability-view';
import { CAPABILITY_ID } from '@/lib/protocol-fixtures';
import { getCapabilityBundle, requirePlatformSession, resolveRoleLens } from '@/lib/platform-data';

export const dynamic = 'force-dynamic';

export default async function CapabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ capabilityId: string }>;
  searchParams: Promise<{ lens?: string }>;
}) {
  const { capabilityId } = await params;
  if (capabilityId !== CAPABILITY_ID) notFound();
  const requestedLens = (await searchParams).lens;
  const returnTo = `/app/capabilities/${capabilityId}${requestedLens ? `?lens=${requestedLens}` : ''}`;
  const session = await requirePlatformSession(returnTo);
  const lens = resolveRoleLens(requestedLens, session.membership.role);
  const bundle = await getCapabilityBundle(capabilityId, session.organization.id);
  if (!bundle) notFound();

  const metrics = getEvidenceMetrics();
  const unresolvedGates = bundle.gates.filter((gate) => gate.state !== 'allow');
  const nextGate = unresolvedGates.find((gate) => ['pending', 'quarantine'].includes(gate.state));
  const roleWorkItem = bundle.workItems.find((item) => item.requiredRole === lens);
  if (!roleWorkItem) throw new Error(`no work item is configured for ${lens}`);
  const canAct =
    session.membership.role === lens ||
    (session.user.userId === 'local_seedy' && session.user.email.endsWith('@sites.test'));
  const settlementQueued = bundle.capability.status === 'settlement_authorized';

  return (
    <AppShell session={session} lens={lens}>
      <div className="mx-auto max-w-3xl">
        <Link href={`/app?lens=${lens}`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted-ink)] hover:underline">
          <ArrowLeft aria-hidden="true" className="size-3" /> queue
        </Link>

        <header className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eyebrow">capability · {capabilityId}</p>
            <span className="data-stamp">synthetic</span>
          </div>
          <h1 className="mt-3 text-[clamp(2rem,6vw,3.7rem)] font-bold leading-[0.98] tracking-[-0.055em]">
            {bundle.capability.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-ink)]">
            {bundle.capability.summary}
          </p>
        </header>

        <div className="mt-8">
          {settlementQueued ? (
            <section className="focus-surface p-5 sm:p-6">
              <p className="eyebrow">current state</p>
              <div className="mt-2 flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[var(--mint)] text-[#22735f]">
                  <Check aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <h2 className="text-xl font-bold tracking-[-0.025em]">settlement handoff queued</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">
                    every role decision and trust gate is recorded. the signed payout intent is waiting for the isolated Solana executor.
                  </p>
                  <Link
                    href={`/receipts/${CAPABILITY_ID}`}
                    className="mt-4 inline-flex items-center gap-2 rounded-md border border-[var(--ink)] bg-[var(--ink)] px-4 py-2.5 text-xs font-bold text-[var(--paper)]"
                  >
                    verify receipt <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </div>
              </div>
            </section>
          ) : lens === 'operator' && nextGate ? (
            <TrustGatePanel gates={[nextGate]} role={lens} />
          ) : (
            <WorkItemAction item={roleWorkItem} lens={lens} canAct={canAct} />
          )}
        </div>

        <section aria-label="proof summary" className="proof-strip mt-4">
          <div>
            <p className="eyebrow">evidence</p>
            <p className="mt-1.5 text-xs font-bold">{metrics.episodes} episodes accepted</p>
          </div>
          <div>
            <p className="eyebrow">evaluation</p>
            <p className="mt-1.5 text-xs font-bold">passed · {percent(metrics.candidateSuccess)}</p>
          </div>
          <div>
            <p className="eyebrow">settlement</p>
            <p className="mt-1.5 text-xs font-bold">
              {settlementQueued ? 'queued · Solana devnet' : `${unresolvedGates.length} checks open`}
            </p>
          </div>
        </section>

        <Link
          href={`/app/capabilities/${capabilityId}/record?lens=${lens}`}
          className="mt-4 flex items-center justify-between border-t py-4 text-xs font-bold hover:underline"
        >
          inspect signed record
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </AppShell>
  );
}
