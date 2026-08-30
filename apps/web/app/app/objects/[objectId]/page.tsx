import { ArrowLeft, Box, Check, FileWarning, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { CAPABILITY_ID, protocolObjectLabel } from '@/lib/protocol-fixtures';
import { getProtocolObject, requirePlatformSession } from '@/lib/platform-data';

export const dynamic = 'force-dynamic';

export default async function ProtocolObjectInspector({ params }: { params: Promise<{ objectId: string }> }) {
  const rawObjectId = (await params).objectId;
  const objectId = decodeURIComponent(rawObjectId);
  const session = await requirePlatformSession(`/app/objects/${encodeURIComponent(objectId)}`);
  if (session.membership.role !== 'operator') notFound();
  const result = await getProtocolObject(objectId, session.organization.id);
  if (!result) notFound();
  const { row, object } = result;

  return (
    <AppShell session={session} lens="operator">
      <div className="mx-auto max-w-[1120px]">
        <Link href={`/app/capabilities/${CAPABILITY_ID}#objects`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted-ink)] hover:underline">
          <ArrowLeft className="size-3" /> back to capability
        </Link>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-5 border-b pb-5">
          <div className="min-w-0">
            <p className="eyebrow">immutable object inspector</p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">{protocolObjectLabel(object.object_type)}</h1>
            <p className="mono mt-3 break-all text-[11px] text-[var(--muted-ink)]">{object.object_id}</p>
          </div>
          <span className="data-stamp">synthetic fixture</span>
        </header>

        <section className="mt-4 grid gap-px overflow-hidden rounded-lg border bg-[var(--line)] sm:grid-cols-4">
          {[
            { label: 'schema', value: 'valid', icon: Check, tone: 'good' },
            { label: 'digest', value: 'verified', icon: Check, tone: 'good' },
            { label: 'signature', value: 'fixture shape only', icon: FileWarning, tone: 'warn' },
            { label: 'trust', value: row.trustState, icon: KeyRound, tone: row.trustState === 'accepted' ? 'good' : 'warn' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="bg-[var(--card)] p-4">
              <div className={`flex items-center gap-2 ${tone === 'good' ? 'text-[#22735f]' : 'text-[#8a4b0f]'}`}>
                <Icon className="size-3.5" />
                <p className="eyebrow !text-current">{label}</p>
              </div>
              <p className="mt-2 text-xs font-bold">{value}</p>
            </div>
          ))}
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
          <section className="surface overflow-hidden">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <Box className="size-4" />
              <div>
                <p className="eyebrow">canonical bytes</p>
                <h2 className="mt-1 text-base font-bold">R2 object payload</h2>
              </div>
            </div>
            <details className="group" open>
              <summary className="cursor-pointer border-b px-5 py-3 text-xs font-bold marker:text-[var(--orange)]">inspect JSON</summary>
              <pre className="mono max-h-[680px] overflow-auto whitespace-pre-wrap break-words p-5 text-[10px] leading-5">{JSON.stringify(object, null, 2)}</pre>
            </details>
          </section>

          <aside className="space-y-4">
            <section className="quiet-surface p-4">
              <p className="eyebrow">identity</p>
              <dl className="mt-4 space-y-3">
                <div><dt className="text-[10px] text-[var(--muted-ink)]">object type</dt><dd className="mono mt-1 break-all text-[10px] font-bold">{object.object_type}</dd></div>
                <div><dt className="text-[10px] text-[var(--muted-ink)]">issued</dt><dd className="mono mt-1 text-[10px] font-bold">{object.issued_at}</dd></div>
                <div><dt className="text-[10px] text-[var(--muted-ink)]">schema version</dt><dd className="mono mt-1 text-[10px] font-bold">{object.schema_version}</dd></div>
              </dl>
            </section>
            <section className="quiet-surface p-4">
              <p className="eyebrow">integrity</p>
              <p className="mono mt-3 break-all text-[10px] leading-5">{object.integrity.object_digest}</p>
              <p className="mt-3 text-[10px] leading-4 text-[var(--muted-ink)]">the digest binds RFC 8785 canonical bytes without the integrity and signatures fields.</p>
            </section>
            <section className="quiet-surface p-4">
              <p className="eyebrow">signer</p>
              <p className="mono mt-3 break-all text-[10px] leading-5">{row.signerKeyId}</p>
              <p className="mt-3 border-l-2 border-[#c97222] pl-2 text-[10px] leading-4 text-[#7f3e08]">fixture signatures prove wire shape only. they are not production authorization.</p>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
