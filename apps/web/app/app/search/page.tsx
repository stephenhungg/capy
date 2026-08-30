import { ArrowLeft, Box, Search } from 'lucide-react';
import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import {
  requirePlatformSession,
  resolveRoleLens,
  searchPlatform,
} from '@/lib/platform-data';

export const dynamic = 'force-dynamic';

export default async function PlatformSearch({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lens?: string }>;
}) {
  const { q = '', lens: requestedLens } = await searchParams;
  const session = await requirePlatformSession(
    `/app/search?q=${encodeURIComponent(q)}`,
  );
  const lens = resolveRoleLens(requestedLens, session.membership.role);
  const results = await searchPlatform(q, session.organization.id);
  const canInspectObjects = session.membership.role === 'operator';

  return (
    <AppShell session={session} lens={lens}>
      <div className="mx-auto max-w-[1080px]">
        <Link
          href={`/app?lens=${lens}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted-ink)] hover:underline"
        >
          <ArrowLeft className="size-3" /> back to work queue
        </Link>
        <header className="mt-4 border-b pb-5">
          <div className="flex items-center gap-2">
            <Search className="size-4" />
            <p className="eyebrow">tenant-scoped search</p>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
            {q ? `results for “${q}”` : 'search the control plane'}
          </h1>
        </header>

        {!q ? (
          <p className="mt-6 text-sm text-[var(--muted-ink)]">
            enter a capability, object id, object type, or digest in the search bar.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="surface overflow-hidden">
              <div className="border-b px-5 py-4">
                <p className="eyebrow">capabilities · {results.capabilities.length}</p>
              </div>
              <div className="divide-y">
                {results.capabilities.map((capability) => (
                  <Link
                    key={capability.id}
                    href={`/app/capabilities/${capability.id}?lens=${lens}`}
                    className="block p-5 hover:bg-[var(--mint)]"
                  >
                    <p className="text-xs font-bold">{capability.title}</p>
                    <p className="mono mt-2 text-[9px] text-[var(--muted-ink)]">
                      {capability.id} · {capability.status}
                    </p>
                  </Link>
                ))}
                {results.capabilities.length === 0 ? (
                  <p className="p-5 text-xs text-[var(--muted-ink)]">no capability matches</p>
                ) : null}
              </div>
            </section>

            <section className="surface overflow-hidden">
              <div className="border-b px-5 py-4">
                <p className="eyebrow">protocol objects · {results.objects.length}</p>
              </div>
              <div className="divide-y">
                {results.objects.map((object) => {
                  const content = (
                    <>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Box className="size-3.5" /> {object.objectType.replaceAll('_', ' ')}
                      </div>
                      <p className="mono mt-2 truncate text-[9px] text-[var(--muted-ink)]">
                        {object.id} · {object.trustState}
                      </p>
                    </>
                  );
                  return canInspectObjects ? (
                    <Link
                      key={object.id}
                      href={`/app/objects/${encodeURIComponent(object.id)}`}
                      className="block p-5 hover:bg-[var(--mint)]"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={object.id} className="p-5">
                      {content}
                    </div>
                  );
                })}
                {results.objects.length === 0 ? (
                  <p className="p-5 text-xs text-[var(--muted-ink)]">no object matches</p>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
