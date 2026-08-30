import { probeI2rtIngest } from "@/lib/i2rt-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const ingress = await probeI2rtIngest();
  const ready = ingress.state === "ready";

  return Response.json(
    {
      ok: ready,
      service: "capy-web",
      deployment: "vercel",
      cameraStreams: 0,
      ingress: {
        state: ingress.state,
        detail: ingress.detail,
        sessions: ingress.status?.sessions ?? null,
        artifacts: ingress.status?.artifacts ?? null,
        lastIngestedAt: ingress.status?.lastIngestedAt ?? null,
      },
      evaluation: {
        dataClass: "synthetic_fixture",
        state: "passed",
      },
      settlement: {
        network: "solana-devnet",
        asset: "USDC",
        state: "planned",
      },
    },
    {
      status: ready ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
