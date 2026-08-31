import type { Metadata } from "next";
import Link from "next/link";

import { probeI2rtIngest } from "@/lib/i2rt-status";

import styles from "../dashboard/page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "network status — capy",
  description: "live camera-free i2rt ingest, evaluation, and payout readiness for capy.",
};

function formatIngestedAt(value: string | null | undefined) {
  if (!value) return "no ingest timestamp";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "timestamp unavailable";
  return `${parsed.toISOString().slice(0, 16).replace("T", " ")} utc`;
}

export default async function Status() {
  const ingress = await probeI2rtIngest();
  const status = ingress.status;
  const isLive = ingress.state === "ready" && status !== null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.wordmark} aria-label="capy home">
            capy
          </Link>
          <div className={styles.networkState} data-live={isLive}>
            <span aria-hidden="true" />
            {isLive ? "network live" : "network degraded"}
          </div>
        </header>

        <section className={styles.intro}>
          <p className={styles.eyebrow}>network status · fixed insertion v1</p>
          <h1>{isLive ? "the ingest loop is live." : "the edge needs attention."}</h1>
          <p>
            one camera-free path from i2rt evidence to verified capability and a gated Solana payout.
          </p>
        </section>

        <section className={styles.nextAction} aria-labelledby="next-action-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>next action</p>
            <span className={styles.statePill}>physical rig</span>
          </div>
          <h2 id="next-action-title">run the first physical YAM session</h2>
          <p>
            the upload and integrity path is verified with a hardware-free fixture. the actual rig still needs its edge token and one completed session before we claim physical evidence.
          </p>
          <div className={styles.actions}>
            <a href="https://github.com/stephenhungg/capy/blob/main/packages/i2rt-recorder/docs/first-physical-session.md">
              open edge setup <span aria-hidden="true">↗</span>
            </a>
            <Link href="/api/health">json status</Link>
          </div>
        </section>

        <section className={styles.capability} aria-labelledby="capability-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>capability</p>
            <span className={styles.dataClass}>mixed live + fixture</span>
          </div>
          <h2 id="capability-title">camera-free keyed-peg insertion</h2>
          <p className={styles.capabilitySummary}>
            contact-robust fixed-geometry insertion on an i2rt YAM right arm.
          </p>

          <dl className={styles.proofGrid}>
            <div>
              <dt>ingress</dt>
              <dd>{isLive ? `${status.sessions.verified} verified` : ingress.state.replaceAll("_", " ")}</dd>
              <p>{isLive ? `${status.artifacts.verified} artifacts · ${formatIngestedAt(status.lastIngestedAt)}` : ingress.detail}</p>
            </div>
            <div>
              <dt>evaluation</dt>
              <dd>75% passed</dd>
              <p>40 sealed trials · synthetic fixture</p>
            </div>
            <div>
              <dt>settlement</dt>
              <dd>100 USDC</dd>
              <p>2 transfers · devnet plan · not sent</p>
            </div>
          </dl>

          <div className={styles.boundary}>
            <span>0 camera streams</span>
            <span>cloud never commands the robot</span>
          </div>
        </section>
      </div>
    </main>
  );
}
