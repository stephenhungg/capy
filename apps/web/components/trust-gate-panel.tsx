import { AlertTriangle, Check, Clock3, ShieldCheck } from 'lucide-react';

import { TrustGateAction } from '@/components/trust-gate-action';
import type { PlatformRole } from '@/lib/platform-data';

type Gate = {
  id: string;
  label: string;
  state: string;
  evidenceRef: string;
  reason: string | null;
  decidedAt: string | null;
  version: number;
};

function GateIcon({ state }: { state: string }) {
  if (state === 'allow') return <Check className="size-3.5" />;
  if (state === 'deny') return <AlertTriangle className="size-3.5" />;
  if (state === 'quarantine') return <ShieldCheck className="size-3.5" />;
  return <Clock3 className="size-3.5" />;
}

export function TrustGatePanel({ gates, role }: { gates: Gate[]; role: PlatformRole }) {
  return (
    <section id="trust" aria-labelledby="trust-title" className="surface overflow-hidden">
      <div className="border-b px-4 py-3.5">
        <p className="eyebrow">trust gates</p>
        <h2 id="trust-title" className="mt-1 text-base font-bold">evidence before execution</h2>
      </div>
      <div className="divide-y">
        {gates.map((gate) => {
          const actionable = role === 'operator' && ['pending', 'quarantine'].includes(gate.state);
          return (
            <article key={gate.id} className="p-4">
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 grid size-6 place-items-center rounded-full border ${
                    gate.state === 'allow'
                      ? 'border-[#65ad99] bg-[var(--mint)] text-[#22735f]'
                      : gate.state === 'deny'
                        ? 'border-[var(--safety)] text-[var(--safety)]'
                        : 'border-[#d28b43] bg-[var(--orange-soft)] text-[#8a4b0f]'
                  }`}
                >
                  <GateIcon state={gate.state} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold">{gate.label}</h3>
                    <span className="mono text-[9px] text-[var(--muted-ink)]">{gate.state}</span>
                  </div>
                  <p className="mono mt-1 truncate text-[9px] text-[var(--muted-ink)]">{gate.evidenceRef}</p>
                  {gate.reason ? <p className="mt-2 text-[10px] leading-4">{gate.reason}</p> : null}
                  {actionable ? (
                    <TrustGateAction gateId={gate.id} version={gate.version} />
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
