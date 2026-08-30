import { getChatGPTUser } from '@/app/chatgpt-auth';
import {
  completeWorkItem,
  ensureSandboxMembership,
  roles,
  type PlatformRole,
} from '@/lib/platform-data';

export async function POST(
  request: Request,
  context: { params: Promise<{ workItemId: string }> },
) {
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

  const expectedVersion =
    'expectedVersion' in body ? body.expectedVersion : undefined;
  const idempotencyKey =
    'idempotencyKey' in body ? body.idempotencyKey : undefined;
  const actedAsRole = 'actedAsRole' in body ? body.actedAsRole : undefined;
  const note = 'note' in body ? body.note : undefined;
  if (
    typeof expectedVersion !== 'number' ||
    typeof idempotencyKey !== 'string' ||
    typeof actedAsRole !== 'string' ||
    !roles.includes(actedAsRole as PlatformRole) ||
    typeof note !== 'string'
  ) {
    return Response.json(
      {
        error:
          'expectedVersion, idempotencyKey, actedAsRole, and note are required',
      },
      { status: 400 },
    );
  }

  try {
    const { workItemId } = await context.params;
    const result = await completeWorkItem({
      workItemId,
      expectedVersion,
      idempotencyKey,
      actedAsRole: actedAsRole as PlatformRole,
      note,
      session: await ensureSandboxMembership(user),
    });
    return Response.json({ ok: true, idempotent: result.idempotent });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'work item completion failed';
    const status = /authentication|membership role|required/.test(message)
      ? 403
      : /not found/.test(message)
        ? 404
        : /version conflict|is completed|is blocked|idempotency|dependency/.test(message)
          ? 409
          : 400;
    return Response.json({ error: message }, { status });
  }
}
