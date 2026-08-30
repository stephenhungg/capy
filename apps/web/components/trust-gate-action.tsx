'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function TrustGateAction({
  gateId,
  version,
}: {
  gateId: string;
  version: number;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('evidence inspected against the current protocol object and trust snapshot');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function decide(decision: 'allow' | 'quarantine' | 'deny') {
    setPending(true);
    setMessage('');
    try {
      const storageKey = `capy:gate-command:${gateId}:${version}:${decision}`;
      let idempotencyKey = sessionStorage.getItem(storageKey);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        sessionStorage.setItem(storageKey, idempotencyKey);
      }
      const response = await fetch(`/api/v1/trust-gates/${encodeURIComponent(gateId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason,
          expectedVersion: version,
          idempotencyKey,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        idempotent?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? 'gate decision failed');
      setMessage(
        result.idempotent
          ? 'the identical gate command was already recorded'
          : `gate recorded as ${decision}`,
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'gate decision failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 border-t pt-3">
      <label htmlFor={`reason-${gateId}`} className="text-[10px] font-bold text-[var(--muted-ink)]">
        decision evidence note
      </label>
      <textarea
        id={`reason-${gateId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        className="mt-1.5 w-full resize-none rounded-md border bg-[var(--paper)] px-2.5 py-2 text-[11px] leading-4"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('allow')}
          className="rounded-md border border-[var(--ink)] bg-[var(--ink)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--paper)] disabled:opacity-50"
        >
          allow
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('quarantine')}
          className="rounded-md border border-[#c97222] bg-[var(--orange-soft)] px-2.5 py-1.5 text-[10px] font-bold text-[#7f3e08] disabled:opacity-50"
        >
          quarantine
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('deny')}
          className="rounded-md border border-[var(--safety)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--safety)] disabled:opacity-50"
        >
          deny
        </button>
      </div>
      {message ? <p aria-live="polite" className="mt-2 text-[10px] text-[var(--muted-ink)]">{message}</p> : null}
    </div>
  );
}
