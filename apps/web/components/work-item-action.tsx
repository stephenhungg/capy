'use client';

import { Check, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { PlatformRole } from '@/lib/platform-data';

type WorkItem = {
  id: string;
  requiredRole: string;
  actionType: string;
  title: string;
  description: string;
  state: string;
  version: number;
  completedAt: string | null;
};

const actionLabels: Record<string, string> = {
  'buyer.authorize_collection_reserve': 'authorize sandbox reserve',
  'contributor.accept_collection_brief': 'accept collection brief',
  'evaluator.declare_no_conflict': 'record no-conflict declaration',
  'operator.authorize_settlement': 'authorize executor handoff',
};

export function WorkItemAction({
  item,
  lens,
  canAct,
}: {
  item: WorkItem;
  lens: PlatformRole;
  canAct: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState(
    'reviewed the current contract, boundary conditions, and evidence available to this role',
  );
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const isBlocked = item.state === 'blocked';
  const isCompleted = item.state === 'completed';

  async function complete() {
    setPending(true);
    setMessage('');
    try {
      const storageKey = `capy:work-command:${item.id}:${item.version}`;
      let idempotencyKey = sessionStorage.getItem(storageKey);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        sessionStorage.setItem(storageKey, idempotencyKey);
      }
      const response = await fetch(
        `/api/v1/work-items/${encodeURIComponent(item.id)}/complete`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedVersion: item.version,
            idempotencyKey,
            actedAsRole: lens,
            note,
          }),
        },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        idempotent?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? 'work item completion failed');
      }
      setMessage(
        result.idempotent
          ? 'already recorded — the retry was safely deduplicated'
          : 'decision recorded in the workflow and audit ledger',
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'work item completion failed',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="role-action" className="focus-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{isCompleted ? 'recorded step' : 'next action'} · {lens}</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.025em]">{item.title}</h2>
        </div>
        <span
          className={`mono rounded-full border px-2 py-1 text-[9px] font-bold ${
            isCompleted
              ? 'border-[#65ad99] bg-[var(--mint)] text-[#22735f]'
              : isBlocked
                ? 'border-[#d28b43] bg-[var(--orange-soft)] text-[#8a4b0f]'
                : 'bg-[var(--card)]'
          }`}
        >
          {item.state}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--muted-ink)]">
        {item.description}
      </p>

      {isCompleted ? (
        <div className="mt-4 flex items-center gap-2 border-t pt-3 text-[11px] font-semibold text-[#22735f]">
          <Check className="size-4" /> recorded once with an immutable transition
        </div>
      ) : isBlocked ? (
        <div className="mt-4 flex items-start gap-2 border-t pt-3 text-[11px] leading-5 text-[#8a4b0f]">
          <LockKeyhole className="mt-0.5 size-4 shrink-0" />
          {item.actionType === 'operator.authorize_settlement'
            ? 'settlement stays locked until every role prerequisite is complete and every trust gate is explicitly allowed.'
            : 'this action stays locked until its preceding workflow decision is complete.'}
        </div>
      ) : !canAct ? (
        <div className="mt-4 flex items-start gap-2 border-t pt-3 text-[11px] leading-5 text-[var(--muted-ink)]">
          <LockKeyhole className="mt-0.5 size-4 shrink-0" />
          view-only role projection. an active {item.requiredRole} membership must record this action.
        </div>
      ) : (
        <div className="mt-5 border-t pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={complete}
            className="rounded-md border border-[var(--ink)] bg-[var(--ink)] px-4 py-2.5 text-xs font-bold text-[var(--paper)] disabled:opacity-50"
          >
            {pending ? 'recording…' : actionLabels[item.actionType] ?? 'complete action'}
          </button>
          <details className="mt-3 max-w-xl">
            <summary className="cursor-pointer text-[10px] font-semibold text-[var(--muted-ink)]">
              add a decision note
            </summary>
            <label htmlFor={`work-note-${item.id}`} className="sr-only">
              decision note
            </label>
            <textarea
              id={`work-note-${item.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              className="mt-2 w-full resize-none rounded-md border bg-[var(--paper)] px-2.5 py-2 text-[11px] leading-4"
            />
          </details>
        </div>
      )}

      {message ? (
        <p
          aria-live="polite"
          className="mt-2 text-[10px] text-[var(--muted-ink)]"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
