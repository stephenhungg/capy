import { getChatGPTUser } from '@/app/chatgpt-auth';
import {
  ensureSandboxMembership,
  inviteOrganizationMember,
  roles,
  type PlatformRole,
} from '@/lib/platform-data';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: 'authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'request body must be an object' }, { status: 400 });
  }
  const email = 'email' in body ? body.email : undefined;
  const role = 'role' in body ? body.role : undefined;
  if (
    typeof email !== 'string' ||
    typeof role !== 'string' ||
    !roles.includes(role as PlatformRole)
  ) {
    return Response.json({ error: 'email and valid role are required' }, { status: 400 });
  }

  try {
    const invite = await inviteOrganizationMember({
      email,
      role: role as PlatformRole,
      session: await ensureSandboxMembership(user),
    });
    return Response.json({ ok: true, invite });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invite failed';
    const status = /operator role|required/.test(message) ? 403 : /already/.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}
