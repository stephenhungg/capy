import {
  attributionObject,
  capabilityObject,
  cohortObject,
  evaluationObject,
  payoutObject,
} from '@/lib/protocol-fixtures';
import type { PlatformRole } from '@/lib/platform-data';

export const roleCopy: Record<
  PlatformRole,
  { eyebrow: string; primaryAction: string; explanation: string; queueLabel: string }
> = {
  buyer: {
    eyebrow: 'buyer lens',
    primaryAction: 'review contract and fund collection',
    explanation: 'budget and aggregate evidence are visible; contributor identity and hidden trials stay sealed.',
    queueLabel: '1 contract awaiting budget authorization',
  },
  contributor: {
    eyebrow: 'contributor lens',
    primaryAction: 'review the matched collection job',
    explanation: 'your eligibility, submissions, and payout state are visible; other contributors stay private.',
    queueLabel: '1 camera-free collection job matched',
  },
  evaluator: {
    eyebrow: 'evaluator lens',
    primaryAction: 'declare conflicts before unsealing',
    explanation: 'the committed protocol is visible; treatment labels and attribution remain hidden until signing.',
    queueLabel: '1 sealed evaluation assignment ready',
  },
  operator: {
    eyebrow: 'operator lens',
    primaryAction: 'resolve blocked trust gates',
    explanation: 'operate evidence and settlement gates without opening raw captures or identity mappings.',
    queueLabel: '2 trust gates need a decision',
  },
};

export function getEvidenceMetrics() {
  const success = evaluationObject.payload.metrics.find((metric) => metric.metric_id === 'task_success_rate');
  const safety = evaluationObject.payload.metrics.find((metric) => metric.metric_id === 'safety_violation_rate');
  return {
    baselineSuccess: success?.baseline ?? 'unknown',
    candidateSuccess: success?.candidate ?? 'unknown',
    absoluteLift: success?.absolute_delta ?? 'unknown',
    confidenceInterval: success?.confidence_interval_95,
    trialCount: success?.sample_size ?? 0,
    safetyViolationRate: safety?.candidate ?? 'unknown',
    episodes: cohortObject.payload.episode_set.episode_count,
    successfulEpisodes: cohortObject.payload.episode_set.successful_episode_count,
    allocationCount: attributionObject.payload.allocations.length,
    payoutBaseUnits: payoutObject.payload.totals.amount_base_units,
    payoutTransferCount: payoutObject.payload.totals.transfer_count,
  };
}

export function getCapabilityFacts() {
  return {
    capabilityTitle: capabilityObject.payload.title,
    capabilitySummary: capabilityObject.payload.summary,
    embodiment: `${capabilityObject.payload.embodiment.manufacturer} ${capabilityObject.payload.embodiment.model}`,
    captureProfile: capabilityObject.payload.interfaces.raw_evidence.profile,
    captureEncoding: capabilityObject.payload.interfaces.raw_evidence.message_encoding,
    cameraFree: cohortObject.payload.privacy.camera_free,
    hiddenSetCommitment: evaluationObject.payload.hidden_set.manifest_commitment,
    hiddenSetState: evaluationObject.payload.hidden_set.reveal_status,
    evaluationPassed: evaluationObject.payload.decision.passed,
    safetyPassed: evaluationObject.payload.safety.passed,
    payoutNetwork: payoutObject.payload.cluster.name,
    payoutAsset: payoutObject.payload.asset.symbol,
    payoutState: payoutObject.payload.settlement.state,
    payoutMemo: payoutObject.payload.transaction_plan[0]?.memo ?? null,
  };
}

export function visibleOperationalFacts(role: PlatformRole) {
  const metrics = getEvidenceMetrics();
  const common = [
    { label: 'capture', value: 'camera-free · direct I2RT' },
    { label: 'evidence', value: `${metrics.episodes} synthetic episodes` },
    { label: 'evaluation', value: `${metrics.trialCount} sealed trials · passed` },
  ];

  if (role === 'buyer') {
    return [...common, { label: 'result', value: `${percent(metrics.baselineSuccess)} → ${percent(metrics.candidateSuccess)}` }];
  }
  if (role === 'contributor') {
    return [...common, { label: 'settlement', value: 'native USDC · planned' }];
  }
  if (role === 'evaluator') {
    return [...common, { label: 'hidden set', value: 'commitment verified · contents sealed' }];
  }
  return [
    ...common,
    { label: 'settlement', value: `${metrics.payoutTransferCount} transfers · memo-less devnet plan` },
  ];
}

export function percent(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${(parsed * 100).toFixed(1)}%` : value;
}
