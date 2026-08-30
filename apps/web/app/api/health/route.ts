import { probePlatformReadiness } from '@/lib/readiness';

export async function GET() {
  const readiness = await probePlatformReadiness();
  return Response.json(
    {
      ok: readiness.ready,
      service: 'capy-control-plane',
      environment: 'sandbox',
      payoutNetwork: 'solana-devnet',
      cameraStreams: 0,
      readiness,
    },
    {
      status: readiness.ready ? 200 : 503,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
