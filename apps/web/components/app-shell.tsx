import { ChevronDown, Settings2 } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { chatGPTSignOutPath } from '@/app/chatgpt-auth';
import { CAPABILITY_ID } from '@/lib/protocol-fixtures';
import { roles, type PlatformRole, type PlatformSession } from '@/lib/platform-data';

export function AppShell({
  session,
  lens,
  children,
}: {
  session: PlatformSession;
  lens: PlatformRole;
  children: ReactNode;
}) {
  const initials = session.user.displayName
    .split(/\s+|@/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLowerCase();
  const canSimulateRoles =
    session.user.userId === 'local_seedy' &&
    session.user.email.endsWith('@sites.test');

  return (
    <div className="app-frame">
      <header className="app-topbar">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/app" className="wordmark text-[1.6rem] leading-none" aria-label="capy home">
            capy
          </Link>
          <span className="hidden h-4 w-px bg-[var(--line)] sm:block" />
          <span className="hidden truncate text-[11px] font-semibold text-[var(--muted-ink)] sm:block">
            {session.organization.name}
          </span>
        </div>

        <nav aria-label="workspace" className="app-topnav">
          <Link href={`/app?lens=${lens}`}>queue</Link>
          <Link href={`/app/capabilities/${CAPABILITY_ID}?lens=${lens}`}>capability</Link>

          <details className="account-menu">
            <summary aria-label="open account menu">
              <span className="grid size-7 place-items-center rounded-full border bg-[var(--blue-soft)] text-[10px] font-bold">
                {initials || 'op'}
              </span>
              <span className="hidden text-[11px] font-semibold sm:inline">{lens}</span>
              <ChevronDown aria-hidden="true" className="size-3 text-[var(--muted-ink)]" />
            </summary>
            <div className="account-popover">
              <p className="truncate text-xs font-bold">{session.user.displayName}</p>
              <p className="mt-0.5 truncate text-[10px] text-[var(--muted-ink)]">
                {session.membership.role} · sandbox
              </p>

              {canSimulateRoles ? (
                <div className="mt-3 border-t pt-3">
                  <p className="eyebrow">preview as</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {roles.map((role) => (
                      <Link
                        key={role}
                        href={`/app?lens=${role}`}
                        aria-current={role === lens ? 'page' : undefined}
                        className={role === lens ? 'is-current' : undefined}
                      >
                        {role}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {session.membership.role === 'operator' ? (
                <Link href="/app/settings/members" className="account-link mt-3 border-t pt-3">
                  <Settings2 aria-hidden="true" className="size-3.5" /> members
                </Link>
              ) : null}
              <Link href="/status" className="account-link">system status</Link>
              <a href={chatGPTSignOutPath('/')} target="_top" className="account-link">
                sign out
              </a>
            </div>
          </details>
        </nav>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
