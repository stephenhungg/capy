import { ArrowRight, CircleCheck, Database, ShieldCheck, WalletCards } from 'lucide-react';
import Link from 'next/link';

import { chatGPTSignInPath } from '@/app/chatgpt-auth';
import { CAPABILITY_ID, protocolObjects } from '@/lib/protocol-fixtures';

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-4 sm:px-7 sm:py-6">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between border-b pb-4">
        <Link href="/" className="wordmark text-[1.9rem] leading-none">capy</Link>
        <nav className="flex items-center gap-2 text-xs font-semibold" aria-label="public">
          <Link href="/status" className="rounded-md px-2 py-1.5 hover:bg-[var(--mint)]">status</Link>
          <Link href={`/receipts/${CAPABILITY_ID}`} className="rounded-md px-2 py-1.5 hover:bg-[var(--mint)]">inspect receipt</Link>
          <a
            href={chatGPTSignInPath('/app')}
            target="_top"
            className="rounded-md border border-[var(--ink)] bg-[var(--ink)] px-3 py-2 text-[var(--paper)]"
          >
            open control plane
          </a>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-96px)] max-w-[1180px] items-center gap-12 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <span className="data-stamp">sandbox · synthetic fixture</span>
          <p className="eyebrow mt-7">robot capability infrastructure</p>
          <h1 className="mt-3 max-w-[700px] text-[clamp(2.7rem,6.8vw,6rem)] font-bold leading-[0.9] tracking-[-0.065em]">
            prove the skill.
            <br />
            pay the evidence.
          </h1>
          <p className="mt-6 max-w-[590px] text-base leading-7 text-[var(--muted-ink)] sm:text-lg">
            capy turns a robot failure into a signed collection contract, camera-free evidence, sealed evaluation,
            deterministic attribution, and memo-less native USDC settlement.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <a
              href={chatGPTSignInPath('/app')}
              target="_top"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--ink)] bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-[var(--paper)]"
            >
              enter the working platform <ArrowRight className="size-4" />
            </a>
            <Link
              href={`/receipts/${CAPABILITY_ID}`}
              className="rounded-md border bg-[var(--card)] px-4 py-2.5 text-sm font-bold"
            >
              verify public receipt
            </Link>
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--muted-ink)]">
            synthetic pipeline fixture — not hardware evidence and not a capy performance claim.
          </p>
        </div>

        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b bg-[var(--mint)] px-5 py-4">
            <div>
              <p className="eyebrow">live canonical workflow</p>
              <h2 className="mt-1 text-lg font-bold">keyed-peg recovery · I2RT YAM</h2>
            </div>
            <span className="mono rounded border bg-[var(--paper)] px-2 py-1 text-[10px]">5 objects</span>
          </div>
          <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2">
            {[
              { icon: Database, label: 'capture', value: 'direct I2RT · JSON MCAP', note: '0 camera streams' },
              { icon: ShieldCheck, label: 'evaluation', value: 'hidden set sealed', note: '40 synthetic trials' },
              { icon: CircleCheck, label: 'attribution', value: 'base units conserved', note: '2 allocations' },
              { icon: WalletCards, label: 'settlement', value: 'native USDC · devnet', note: 'memo: null' },
            ].map(({ icon: Icon, label, value, note }) => (
              <article key={label} className="bg-[var(--card)] p-5">
                <Icon className="size-4" aria-hidden="true" />
                <p className="eyebrow mt-5">{label}</p>
                <p className="mt-1 text-sm font-bold">{value}</p>
                <p className="mono mt-1 text-[10px] text-[var(--muted-ink)]">{note}</p>
              </article>
            ))}
          </div>
          <div className="px-5 py-4">
            <ol className="flex items-center">
              {protocolObjects.map((object, index) => (
                <li key={object.object_id} className="flex flex-1 items-center last:flex-none">
                  <span className="grid size-5 place-items-center rounded-full bg-[var(--ink)] text-[9px] font-bold text-[var(--paper)]">{index + 1}</span>
                  {index < protocolObjects.length - 1 ? <span className="signal-line is-live" /> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}
