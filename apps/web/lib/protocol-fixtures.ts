import attributionJson from '../../../docs/protocol/examples/04-camera-free-yam-attribution.json';
import capabilityJson from '../../../docs/protocol/examples/01-camera-free-yam-capability.json';
import cohortJson from '../../../docs/protocol/examples/02-camera-free-yam-cohort.json';
import evaluationJson from '../../../docs/protocol/examples/03-camera-free-yam-evaluation.json';
import payoutJson from '../../../docs/protocol/examples/05-camera-free-yam-payout.json';

export type ProtocolObjectType =
  | 'capability_manifest'
  | 'episode_cohort'
  | 'evaluation_receipt'
  | 'attribution_result'
  | 'solana_payout_manifest';

export type ProtocolObject = {
  $schema: string;
  protocol_version: string;
  schema_version: string;
  object_type: ProtocolObjectType;
  object_id: string;
  issued_at: string;
  payload: Record<string, unknown>;
  integrity: {
    canonicalization: 'RFC8785';
    hash_algorithm: 'sha-256';
    digest_scope: 'object-without-integrity-or-signatures';
    object_digest: string;
  };
  signatures: Array<{
    algorithm: 'Ed25519';
    key_id: string;
    signed_digest: string;
    signature_base64url: string;
    created_at: string;
  }>;
};

export const CAPABILITY_ID = 'cap-yam-fixed-insertion-v1';
export const ORGANIZATION_ID = 'org-capy-lab-sandbox';

export const protocolObjects = [
  capabilityJson,
  cohortJson,
  evaluationJson,
  attributionJson,
  payoutJson,
] as ProtocolObject[];

export const capabilityObject = capabilityJson as ProtocolObject & {
  payload: {
    title: string;
    summary: string;
    embodiment: { manufacturer: string; model: string; configuration_id: string };
    interfaces: {
      raw_evidence: { profile: string; message_encoding: string };
      normalized_training: { format: string; format_version: string; visual_features_allowed: boolean };
    };
    baseline_failure: { failure_rate: string; sample_size: number };
    evaluation_protocol: { hidden_set: { manifest_commitment: string }; minimum_trials: number };
  };
};

export const cohortObject = cohortJson as ProtocolObject & {
  payload: {
    status: string;
    episode_set: { episode_count: number; successful_episode_count: number };
    raw_recordings: Array<{
      profile: string;
      producer: { name: string; version: string };
      message_encoding: string;
      indexed: boolean;
      crc_verified: boolean;
    }>;
    privacy: { camera_free: boolean };
  };
};

export const evaluationObject = evaluationJson as ProtocolObject & {
  payload: {
    hidden_set: { reveal_status: string; manifest_commitment: string };
    metrics: Array<{
      metric_id: string;
      sample_size: number;
      baseline: string;
      candidate: string;
      absolute_delta: string;
      confidence_interval_95?: { lower: string; upper: string; method: string };
    }>;
    safety: { violation_count: number; emergency_stop_count: number; passed: boolean };
    decision: { passed: boolean; reasons: string[] };
  };
};

export const attributionObject = attributionJson as ProtocolObject & {
  payload: {
    allocations: Array<{
      allocation_id: string;
      contributor_id: string;
      weight_ppm: number;
      payout_amount_base_units: string;
    }>;
    payout_pool: { asset: string; amount_base_units: string };
    conservation: { allocated_base_units: string; unallocated_base_units: string };
  };
};

export const payoutObject = payoutJson as ProtocolObject & {
  payload: {
    cluster: { name: string };
    asset: { symbol: string; decimals: number; mint: string };
    totals: { transfer_count: number; amount_base_units: string };
    transaction_plan: Array<{ batch_id: string; memo: null }>;
    settlement: { state: string };
  };
};

export const lifecycleFixture = [
  { id: 'life-01', stage: 'failure', label: 'failure locked', state: 'complete', objectId: capabilityObject.object_id },
  { id: 'life-02', stage: 'contract', label: 'contract signed', state: 'complete', objectId: capabilityObject.object_id },
  { id: 'life-03', stage: 'collection', label: '120 episodes accepted', state: 'complete', objectId: cohortObject.object_id },
  { id: 'life-04', stage: 'evaluation', label: 'hidden evaluation sealed', state: 'complete', objectId: evaluationObject.object_id },
  { id: 'life-05', stage: 'attribution', label: 'allocation conserved', state: 'complete', objectId: attributionObject.object_id },
  { id: 'life-06', stage: 'settlement', label: 'memo-less payout planned', state: 'current', objectId: payoutObject.object_id },
] as const;

export const trustGateFixture = [
  {
    id: 'gate-rights',
    gateType: 'rights',
    label: 'contributor rights snapshot',
    state: 'allow',
    evidenceRef: 'urn:capy:trust:rights-snapshot:yam-001',
  },
  {
    id: 'gate-evaluator-conflict',
    gateType: 'evaluator_conflict',
    label: 'evaluator conflict disclosure',
    state: 'allow',
    evidenceRef: 'urn:capy:trust:evaluator-conflict:yam-001',
  },
  {
    id: 'gate-wallet-binding',
    gateType: 'wallet_binding',
    label: 'wallet binding freshness',
    state: 'quarantine',
    evidenceRef: 'urn:capy:trust:wallet-binding:yam-001',
  },
  {
    id: 'gate-payout-privacy',
    gateType: 'payout_privacy',
    label: 'memo-less payout projection',
    state: 'pending',
    evidenceRef: payoutObject.object_id,
  },
] as const;

export function objectR2Key(object: ProtocolObject): string {
  return `protocol/v1/${object.integrity.object_digest.replace(':', '/')}.json`;
}

export function protocolObjectLabel(type: ProtocolObjectType): string {
  return {
    capability_manifest: 'capability contract',
    episode_cohort: 'episode cohort',
    evaluation_receipt: 'evaluation receipt',
    attribution_result: 'attribution result',
    solana_payout_manifest: 'payout intent',
  }[type];
}
