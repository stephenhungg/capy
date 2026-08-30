import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { AuditLedger } from '@/components/audit-ledger';
import { EvidenceBus } from '@/components/evidence-bus';
import { ProtocolObjectList } from '@/components/protocol-object-list';
import { TrustGatePanel } from '@/components/trust-gate-panel';
import { getCapabilityFacts, getEvidenceMetrics, percent } from '@/lib/capability-view';
import { CAPABILITY_ID } from '@/lib/protocol-fixtures';
import { getCapabilityBundle, requirePlatformSession, resolveRoleLens } from '@/lib/platform-data';

export const dynamic = 'force-dynamic';

export default async function CapabilityRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ capabilityId: string }>;
  searchParams: Promise<{ lens?: string }>;
}) {
  const { capabilityId } = await params;
  if (capabilityId !== CAPABILITY_ID) notFound();
  const requestedLens = (await searchParams).lens;
  const returnTo = `/app/capabilities/${capabilityId}/record${requestedLens ? `?lens=${requestedLens}` : ''}`;
  const session = await requirePlatformSession(returnTo);
  const lens = resolveRoleLens(requestedLens, session.membership.role);
  const bundle = await getCapabilityBundle(capabilityId, session.organization.id);
  if (!bundle) notFound();

  const metrics = getEvidenceMetrics();
  const facts = getCapabilityFacts();
  const unresolved = bundle.gates.filter((gate) => gate.state !== 'allow').length;

  return (
    <AppShell session={session} lens={lens}>
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/app/capabilities/${capabilityId}?lens=${lens}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted-ink)] hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-3" /> capability
        </Link>

        <header className="mt-5 border-b pb-5">
          <p className="eyebrow">technical record · {lens} projection</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">signed evidence record</h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--muted-ink)]">
            canonical objects, trust decisions, and append-only workflow activity. all values on this sandbox record are synthetic.
          </p>
        </header>

        <div className="mt-5 space-y-4">
          <EvidenceBus
            items={bundle.lifecycle}
            canInspect={session.membership.role === 'operator'}
            blockedGates={unresolved}
          />

          <section className="proof-strip" aria-label="evaluation and settlement details">
            <div>
              <p className="eyebrow">evaluation</p>
              <p className="mt-1.5 text-xs font-bold">{metrics.trialCount} trials · {percent(metrics.candidateSuccess)}</p>
            </div>
            <div>
              <p className="eyebrow">safety</p>
              <p className="mt-1.5 text-xs font-bold">0 violations · passed</p>
            </div>
            <div>
              <p className="eyebrow">payout intent</p>
              <p className="mt-1.5 text-xs font-bold">{metrics.payoutTransferCount} transfers · memo {String(facts.payoutMemo)}</p>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
            <ProtocolObjectList
              objects={bundle.objects}
              canInspect={session.membership.role === 'operator'}
            />
            <TrustGatePanel gates={bundle.gates} role={lens} />
          </div>

          {lens === 'operator' ? <AuditLedger events={bundle.audits} /> : null}
        </div>
      </div>
    </AppShell>
  );
}
