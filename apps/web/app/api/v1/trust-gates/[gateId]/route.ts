import { getChatGPTUser } from '@/app/chatgpt-auth';
import { decideTrustGate, ensureSandboxMembership } from '@/lib/platform-data';

export async function POST(request: Request, context: { params: Promise<{ gateId: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'request body must be an object' }, { status: 400 });
  }
  const decision = 'decision' in body ? body.decision : undefined;
  const reason = 'reason' in body ? body.reason : undefined;
  const expectedVersion = 'expectedVersion' in body ? body.expectedVersion : undefined;
  const idempotencyKey = 'idempotencyKey' in body ? body.idempotencyKey : undefined;
  if (
    !['allow', 'quarantine', 'deny'].includes(String(decision)) ||
    typeof reason !== 'string' ||
    typeof expectedVersion !== 'number' ||
    typeof idempotencyKey !== 'string'
  ) {
    return Response.json(
      {
        error:
          'decision, reason, expectedVersion, and idempotencyKey are required',
      },
      { status: 400 },
    );
  }

  try {
    const { gateId } = await context.params;
    const result = await decideTrustGate({
      gateId,
      decision: decision as 'allow' | 'quarantine' | 'deny',
      reason,
      expectedVersion,
      idempotencyKey,
      session: await ensureSandboxMembership(user),
    });
    return Response.json({ ok: true, idempotent: result.idempotent });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'gate decision failed';
    const status = /required/.test(message)
      ? 403
      : /not found/.test(message)
        ? 404
        : /finalized|authorized|reconciliation|version conflict|idempotency/.test(message)
          ? 409
          : 400;
    return Response.json({ error: message }, { status });
  }
}
