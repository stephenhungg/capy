import Link from 'next/link';

export type LifecycleItem = {
  id: string;
  label: string;
  state: string;
  objectId: string | null;
};

export function EvidenceBus({
  items,
  canInspect,
  blockedGates,
}: {
  items: LifecycleItem[];
  canInspect: boolean;
  blockedGates: number;
}) {
  return (
    <section aria-labelledby="evidence-bus-title" className="surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">evidence lifecycle</p>
          <h2 id="evidence-bus-title" className="mt-1 text-base font-bold tracking-[-0.02em]">
            signed state, not dashboard theater
          </h2>
        </div>
        <p className="mono text-[10px] text-[var(--muted-ink)]">
          {items.length} immutable objects · {blockedGates} settlement gate(s) blocking
        </p>
      </div>

      <ol className="mt-5 flex min-w-0 items-start overflow-x-auto pb-2">
        {items.map((item, index) => {
          const isCurrent = item.state === 'current';
          const isComplete = item.state === 'complete';
          return (
            <li key={item.id} className="flex min-w-[132px] flex-1 items-start last:flex-none">
              <div className="min-w-[112px]">
                {item.objectId && canInspect ? (
                  <Link href={`/app/objects/${encodeURIComponent(item.objectId)}`} className="group block">
                    <span
                      className={`grid size-5 place-items-center rounded-full border-2 text-[9px] font-bold ${
                        isComplete
                          ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                          : 'border-[var(--orange)] bg-[var(--orange-soft)]'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="mt-2 block text-[11px] font-semibold leading-4 group-hover:underline">{item.label}</span>
                    <span className="mono mt-1 block text-[9px] text-[var(--muted-ink)]">
                      {isCurrent ? 'current gate' : 'object linked'}
                    </span>
                  </Link>
                ) : item.objectId ? (
                  <div>
                    <span
                      className={`grid size-5 place-items-center rounded-full border-2 text-[9px] font-bold ${
                        isComplete
                          ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                          : 'border-[var(--orange)] bg-[var(--orange-soft)]'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="mt-2 block text-[11px] font-semibold leading-4">{item.label}</span>
                    <span className="mono mt-1 block text-[9px] text-[var(--muted-ink)]">
                      {isCurrent ? 'current gate' : 'object linked'}
                    </span>
                  </div>
                ) : null}
              </div>
              {index < items.length - 1 ? (
                <span aria-hidden="true" className={`signal-line mt-[9px] ${isComplete ? 'is-live' : ''}`} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
