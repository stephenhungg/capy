import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { MemberDirectory } from '@/components/member-directory';
import {
  getOrganizationDirectory,
  requirePlatformSession,
} from '@/lib/platform-data';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const session = await requirePlatformSession('/app/settings/members');
  if (session.membership.role !== 'operator') notFound();
  const directory = await getOrganizationDirectory(session);

  return (
    <AppShell session={session} lens="operator">
      <div className="mx-auto max-w-3xl">
        <header>
          <p className="eyebrow">settings</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">members</h1>
          <p className="mt-2 text-sm text-[var(--muted-ink)]">
            invite people into a single role. site access is managed separately.
          </p>
        </header>
        <div className="mt-6">
          <MemberDirectory members={directory.members} invites={directory.invites} />
        </div>
      </div>
    </AppShell>
  );
}
