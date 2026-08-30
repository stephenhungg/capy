import { Check, Database, FileKey2 } from 'lucide-react';
import Link from 'next/link';

import { protocolObjectLabel, type ProtocolObjectType } from '@/lib/protocol-fixtures';

type ObjectRow = {
  id: string;
  objectType: string;
  issuedAt: string;
  digest: string;
  signerKeyId: string;
  signatureState: string;
  artifactState: string;
  trustState: string;
};

function shortDigest(digest: string) {
  return `${digest.slice(0, 15)}…${digest.slice(-8)}`;
}

export function ProtocolObjectList({
  objects,
  canInspect,
}: {
  objects: ObjectRow[];
  canInspect: boolean;
}) {
  return (
    <section id="objects" aria-labelledby="protocol-objects-title" className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
        <div>
          <p className="eyebrow">protocol object graph</p>
          <h2 id="protocol-objects-title" className="mt-1 text-base font-bold">canonical evidence spine</h2>
        </div>
        <span className="mono rounded border bg-[var(--mint)] px-2 py-1 text-[10px]">{objects.length} / 5 linked</span>
      </div>
      <div className="divide-y">
        {objects.map((object, index) => {
          const content = (
            <>
            <div className="grid size-8 place-items-center rounded-md border bg-[var(--paper)]">
              {index === objects.length - 1 ? <FileKey2 className="size-3.5" /> : <Database className="size-3.5" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold">
                  {protocolObjectLabel(object.objectType as ProtocolObjectType)}
                </span>
                <span className="mono rounded bg-[var(--muted)] px-1.5 py-0.5 text-[9px]">v1.0.0</span>
              </div>
              <p className="mono mt-1 truncate text-[10px] text-[var(--muted-ink)]">{shortDigest(object.digest)}</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-[#22735f]">
                <Check className="size-3" /> bytes stored
              </span>
              <span className={object.trustState === 'accepted' ? 'text-[#22735f]' : 'text-[#8a4b0f]'}>
                {object.trustState}
              </span>
            </div>
            </>
          );
          const className =
            'grid gap-3 px-4 py-3.5 sm:grid-cols-[34px_1fr_auto] sm:items-center sm:px-5';
          return canInspect ? (
            <Link
              key={object.id}
              href={`/app/objects/${encodeURIComponent(object.id)}`}
              className={`${className} hover:bg-[var(--mint)]`}
            >
              {content}
            </Link>
          ) : (
            <div key={object.id} className={className}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
