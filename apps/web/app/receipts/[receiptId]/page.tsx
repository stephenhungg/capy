import { Check, ExternalLink, FileCheck2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getEvidenceMetrics, percent } from '@/lib/capability-view';
import { CAPABILITY_ID } from '@/lib/protocol-fixtures';
import { getPublicReceiptBundle } from '@/lib/platform-data';

export const dynamic = 'force-dynamic';

export default async function PublicReceipt({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  if (receiptId !== CAPABILITY_ID) notFound();
  const bundle = await getPublicReceiptBundle(receiptId);
  if (!bundle) notFound();
  const metrics = getEvidenceMetrics();

  return (
    <main className="min-h-screen px-4 py-5 sm:px-7">
      <header className="mx-auto flex max-w-[980px] items-center justify-between border-b pb-4">
        <Link href="/" className="wordmark text-[1.8rem]">capy</Link>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Link href="/status" className="rounded-md px-2 py-1.5 hover:bg-[var(--mint)]">status</Link>
          <Link href="/app" className="rounded-md border border-[var(--ink)] px-3 py-2">open app</Link>
        </div>
      </header>

      <article className="surface mx-auto mt-8 max-w-[980px] overflow-hidden">
        <div className="border-b bg-[var(--mint)] p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="eyebrow">public capability receipt</p>
              <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:text-5xl">keyed-peg recovery</h1>
              <p className="mono mt-3 text-[10px] text-[var(--muted-ink)]">{receiptId}</p>
            </div>
            <div className="grid size-16 place-items-center rounded-full border-2 border-[#22735f] bg-[var(--paper)] text-[#22735f]">
              <FileCheck2 className="size-7" />
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-[var(--muted-ink)]">{bundle.capability.summary}</p>
          <span className="data-stamp mt-5">synthetic fixture · not a performance claim</span>
        </div>

        <div className="grid gap-px bg-[var(--line)] sm:grid-cols-4">
          {[
            ['baseline', percent(metrics.baselineSuccess)],
            ['candidate', percent(metrics.candidateSuccess)],
            ['absolute lift', percent(metrics.absoluteLift)],
            ['safety violations', '0'],
          ].map(([label, value]) => (
            <dl key={label} className="bg-[var(--card)] p-5">
              <dt className="eyebrow">{label}</dt>
              <dd className="mono mt-2 text-2xl font-bold">{value}</dd>
            </dl>
          ))}
        </div>

        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_280px]">
          <section>
            <p className="eyebrow">linked evidence</p>
            <ol className="mt-4 divide-y border-y">
              {bundle.objects.map((object) => (
                <li key={object.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="flex items-center gap-2 text-xs font-bold"><Check className="size-3.5 text-[#22735f]" /> {object.objectType.replaceAll('_', ' ')}</div>
                  <span className="mono text-[9px] text-[var(--muted-ink)]">{object.digest.slice(0, 22)}…</span>
                </li>
              ))}
            </ol>
          </section>

          <aside className="quiet-surface p-4">
            <p className="eyebrow">public projection</p>
            <p className="mt-3 text-xs font-bold">deliberately incomplete</p>
            <p className="mt-2 text-[10px] leading-5 text-[var(--muted-ink)]">raw captures, hidden items, contributor identity, attribution traces, wallet mappings, commercial terms, and model artifacts are not published.</p>
            <div className="mt-4 border-t pt-4">
              <p className="text-[10px] text-[var(--muted-ink)]">settlement</p>
              <p className="mono mt-1 text-[10px] font-bold">planned · Solana Devnet · memo null</p>
              <p className="mt-2 text-[10px] text-[var(--muted-ink)]">no transaction signature exists yet.</p>
            </div>
          </aside>
        </div>
      </article>

      <footer className="mx-auto flex max-w-[980px] items-center justify-between py-5 text-[10px] text-[var(--muted-ink)]">
        <span>capy protocol 1.0.0 · sandbox receipt</span>
        <Link href="/status" className="inline-flex items-center gap-1 hover:underline">resolver status <ExternalLink className="size-3" /></Link>
      </footer>
    </main>
  );
}
