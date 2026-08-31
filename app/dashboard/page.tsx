import type { Metadata } from "next";
import Link from "next/link";

import { publicDemo } from "@/lib/public-demo";
import { getPublicDemoPresentation } from "@/lib/public-demo-state";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "contributor dashboard — capy",
  description: "a read-only synthetic walkthrough from camera-free robot evidence to a projected contributor payout.",
};

export default function Dashboard() {
  const { job, submission, evaluation, payout } = publicDemo;
  const presentation = getPublicDemoPresentation({
    evaluationPassed: evaluation.passed,
    contributorEligible: payout.contributorEligible,
    payoutState: payout.state,
  });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.wordmark} aria-label="capy home">
            capy
          </Link>
          <div className={styles.demoIdentity} aria-label="synthetic contributor demo">
            <span>contributor</span>
            <span className={styles.demoPill}>synthetic demo</span>
          </div>
        </header>

        <section className={styles.intro}>
          <p className={styles.eyebrow}>contributor dashboard · read only</p>
          <h1>{presentation.headline}</h1>
          <p>
            follow one camera-free YAM job from accepted evidence to {presentation.payoutVisible ? "a projected payout" : "its current review gate"}. this walkthrough cannot upload data, connect a wallet, or send funds.
          </p>
        </section>

        <section className={styles.nextAction} aria-labelledby="current-state-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>matched job</p>
            <span className={styles.statePill}>{presentation.reviewState}</span>
          </div>
          <h2 id="current-state-title">{job.title}</h2>
          <p>{job.summary}</p>
          <div className={styles.jobFacts} aria-label="job facts">
            <span>{job.embodiment}</span>
            <span>{job.capture}</span>
            <span>{submission.cameraStreams} cameras</span>
          </div>
        </section>

        <section className={styles.lifecycle} aria-labelledby="lifecycle-title">
          <h2 className={styles.eyebrow} id="lifecycle-title">submission path</h2>
          <ol>
            {presentation.lifecycle.map((step, index) => (
              <li
                key={step.label}
                data-current={step.state === "current"}
                data-state={step.state}
                aria-current={step.state === "current" ? "step" : undefined}
              >
                <span aria-hidden="true">{index + 1}</span>
                {step.label}
              </li>
            ))}
          </ol>
        </section>

        <section id="proof" className={styles.capability} aria-labelledby="proof-title">
          <div className={styles.sectionHeading}>
            <h2 className={styles.eyebrow} id="proof-title">read-only proof</h2>
            <span className={styles.dataClass}>synthetic fixture</span>
          </div>

          <dl className={styles.proofGrid}>
            <div>
              <dt>submission</dt>
              <dd>{submission.episodes} accepted</dd>
              <p>{submission.successfulEpisodes} success labels · {submission.rejectedEpisodes} rejected</p>
            </div>
            <div>
              <dt>evaluation</dt>
              <dd>{evaluation.baseline} → {evaluation.candidate}</dd>
              <p>{evaluation.trials} trials · +{evaluation.liftPercentagePoints} pp · {evaluation.safetyViolations} safety violations</p>
            </div>
            <div>
              <dt>{presentation.payoutVisible ? "projected payout" : "payout"}</dt>
              <dd>{presentation.payoutVisible ? `${payout.projectedAmount} ${payout.asset}` : "locked"}</dd>
              <p>{presentation.payoutVisible ? `${payout.contributorSharePercent}% of ${payout.poolAmount} ${payout.asset} · ${payout.network} · not sent` : "evaluation and attribution must clear first"}</p>
            </div>
          </dl>

          <div className={styles.qualityRow} aria-label="submission quality checks">
            <span>{submission.topicsPresent ? "required channels present" : "channels incomplete"}</span>
            <span>{submission.monotonicTimestamps ? "timestamps monotonic" : "timestamp review needed"}</span>
            <span>{submission.alignmentP95Ms} ms alignment p95</span>
          </div>

          <div className={styles.boundary}>
            <span>synthetic fixture only · no physical session</span>
            <span>{payout.state} · {payout.transactions} transactions · no funds moved</span>
          </div>
        </section>

        <div className={styles.demoActions}>
          <button type="button" disabled>upload unavailable in demo</button>
          <Link href="/status">view live system status <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </main>
  );
}
