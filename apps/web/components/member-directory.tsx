'use client';

import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { PlatformRole } from '@/lib/platform-data';

type Member = {
  principalId: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
};

export function MemberDirectory({
  members,
  invites,
}: {
  members: Member[];
  invites: Invite[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformRole>('contributor');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function invite() {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/memberships/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? 'invite failed');
      setMessage('organization invite recorded');
      setEmail('');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'invite failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <UserPlus className="size-4" />
        <div>
          <p className="eyebrow">separation of duties</p>
          <h2 className="mt-1 text-base font-bold">organization members</h2>
        </div>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="eyebrow">active members</p>
          <ol className="mt-3 divide-y border-y">
            {members.map((member) => (
              <li
                key={member.principalId}
                className="flex items-center justify-between gap-3 py-2.5 text-[10px]"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{member.displayName}</p>
                  <p className="mono truncate text-[9px] text-[var(--muted-ink)]">
                    {member.email}
                  </p>
                </div>
                <span className="data-stamp">{member.role}</span>
              </li>
            ))}
          </ol>
          {invites.filter((invite) => invite.status === 'pending').length > 0 ? (
            <p className="mt-3 text-[10px] text-[var(--muted-ink)]">
              {invites.filter((invite) => invite.status === 'pending').length}{' '}
              organization invite(s) pending sign-in.
            </p>
          ) : null}
        </div>

        <div className="quiet-surface p-4">
          <p className="eyebrow">invite a role holder</p>
          <label className="mt-3 block text-[10px] font-bold" htmlFor="invite-email">
            email
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="person@example.com"
            className="mt-1.5 w-full rounded-md border bg-[var(--paper)] px-2.5 py-2 text-xs"
          />
          <label className="mt-3 block text-[10px] font-bold" htmlFor="invite-role">
            role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as PlatformRole)}
            className="mt-1.5 w-full rounded-md border bg-[var(--paper)] px-2.5 py-2 text-xs"
          >
            <option value="buyer">buyer</option>
            <option value="contributor">contributor</option>
            <option value="evaluator">evaluator</option>
            <option value="operator">operator</option>
          </select>
          <button
            type="button"
            disabled={pending || email.trim().length === 0}
            onClick={invite}
            className="mt-3 rounded-md border border-[var(--ink)] bg-[var(--ink)] px-3 py-2 text-[10px] font-bold text-[var(--paper)] disabled:opacity-50"
          >
            {pending ? 'recording…' : 'create organization invite'}
          </button>
          <p className="mt-2 text-[9px] leading-4 text-[var(--muted-ink)]">
            this assigns an in-app role after the exact email signs in. site-level access is managed separately by the deployment owner.
          </p>
          {message ? (
            <p aria-live="polite" className="mt-2 text-[10px] text-[var(--muted-ink)]">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
