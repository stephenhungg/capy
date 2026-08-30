import { getEvidenceMetrics } from '@/lib/capability-view';
import { CAPABILITY_ID } from '@/lib/protocol-fixtures';
import { getPublicReceiptBundle } from '@/lib/platform-data';

export async function GET(
  _request: Request,
  context: { params: Promise<{ receiptId: string }> },
) {
  const { receiptId } = await context.params;
  if (receiptId !== CAPABILITY_ID) {
    return Response.json({ error: 'receipt not found' }, { status: 404 });
  }
  const bundle = await getPublicReceiptBundle(receiptId);
  if (!bundle) {
    return Response.json({ error: 'receipt not found' }, { status: 404 });
  }
  const metrics = getEvidenceMetrics();

  return Response.json(
    {
      receiptId,
      schemaVersion: 'capy.public-receipt/1.0.0',
      dataClass: 'synthetic_fixture',
      disclaimer: 'not hardware evidence and not a capy performance claim',
      capability: {
        title: bundle.capability.title,
        summary: bundle.capability.summary,
      },
      evaluation: {
        baselineSuccess: metrics.baselineSuccess,
        candidateSuccess: metrics.candidateSuccess,
        absoluteLift: metrics.absoluteLift,
        safetyViolationRate: metrics.safetyViolationRate,
        trialCount: metrics.trialCount,
      },
      objectChain: bundle.objects.map((object) => ({
        objectId: object.id,
        objectType: object.objectType,
        digest: object.digest,
        issuedAt: object.issuedAt,
      })),
      settlement: {
        network: 'solana-devnet',
        state: 'planned',
        memo: null,
        transactionSignature: null,
      },
      withheld: [
        'raw captures',
        'hidden evaluation items',
        'contributor identity',
        'attribution traces',
        'wallet mappings',
        'commercial terms',
        'model artifacts',
      ],
    },
    { headers: { 'cache-control': 'public, max-age=60' } },
  );
}
