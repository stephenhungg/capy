import { Fingerprint } from 'lucide-react';

type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorPrincipalId: string;
  createdAt: string;
};

export function AuditLedger({ events }: { events: AuditEvent[] }) {
  return (
    <section aria-labelledby="audit-title" className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3.5 sm:px-5">
        <Fingerprint className="size-4" />
        <div>
          <p className="eyebrow">operator-only projection</p>
          <h2 id="audit-title" className="mt-1 text-base font-bold">
            append-only audit ledger
          </h2>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="p-5 text-xs text-[var(--muted-ink)]">
          no decisions have been recorded in this environment yet.
        </p>
      ) : (
        <ol className="divide-y">
          {events.map((event) => (
            <li
              key={event.id}
              className="grid gap-2 px-4 py-3 text-[10px] sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
            >
              <div className="min-w-0">
                <p className="font-bold">{event.action.replaceAll('_', ' ')}</p>
                <p className="mono mt-1 truncate text-[9px] text-[var(--muted-ink)]">
                  {event.targetType}:{event.targetId} · actor {event.actorPrincipalId}
                </p>
              </div>
              <time
                dateTime={event.createdAt}
                className="mono text-[9px] text-[var(--muted-ink)]"
              >
                {event.createdAt}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
