import { getChatGPTUser } from '@/app/chatgpt-auth';
import {
  ensureSandboxMembership,
  getProtocolObject,
} from '@/lib/platform-data';

export async function GET(
  _request: Request,
  context: { params: Promise<{ objectId: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: 'authentication required' }, { status: 401 });
  }
  const session = await ensureSandboxMembership(user);
  if (session.membership.role !== 'operator') {
    return Response.json({ error: 'operator role required' }, { status: 403 });
  }

  const { objectId: rawObjectId } = await context.params;
  const objectId = decodeURIComponent(rawObjectId);
  const result = await getProtocolObject(objectId, session.organization.id);
  if (!result) {
    return Response.json({ error: 'protocol object not found' }, { status: 404 });
  }

  return Response.json(
    {
      object: result.object,
      storage: {
        artifactState: result.row.artifactState,
        trustState: result.row.trustState,
        digest: result.row.digest,
        synthetic: result.row.synthetic,
      },
    },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
