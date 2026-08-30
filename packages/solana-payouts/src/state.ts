import { randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { PayoutNetwork } from "./constants.js";

const batchStatusSchema = z.enum([
  "prepared",
  "submitted",
  "finalized",
  "failed",
  "expired_unknown"
]);

const batchJournalSchema = z
  .object({
    batch_id: z.string().length(24),
    index: z.number().int().nonnegative(),
    payout_ids: z.array(z.string().min(8).max(64)).min(1),
    amount_base_units: z.string().regex(/^[0-9]+$/),
    raw_transaction_base64: z.string().min(1),
    raw_transaction_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    signature: z.string().min(80).max(90),
    blockhash: z.string().min(32).max(44),
    last_valid_block_height: z.string().regex(/^[0-9]+$/),
    compute_unit_limit: z.number().int().positive(),
    status: batchStatusSchema,
    attempts: z.number().int().nonnegative(),
    prepared_at: z.string().datetime({ offset: true }),
    last_submitted_at: z.string().datetime({ offset: true }).optional(),
    finalized_at: z.string().datetime({ offset: true }).optional(),
    error: z.string().max(1_000).optional()
  })
  .strict();

const payoutStateSchema = z
  .object({
    schema: z.literal("capy.payout-state.v1"),
    manifest_id: z.string().min(8).max(64),
    manifest_hash: z.string().regex(/^[a-f0-9]{64}$/),
    plan_hash: z.string().regex(/^[a-f0-9]{64}$/),
    network: z.enum(["devnet", "mainnet-beta"]),
    mint: z.string().min(32).max(44),
    treasury_authority: z.string().min(32).max(44),
    source_token_account: z.string().min(32).max(44),
    fee_payer: z.string().min(32).max(44),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
    batches: z.array(batchJournalSchema)
  })
  .strict();

export type BatchStatus = z.infer<typeof batchStatusSchema>;
export type BatchJournal = z.infer<typeof batchJournalSchema>;
export type PayoutStateV1 = z.infer<typeof payoutStateSchema>;

export interface StateIdentity {
  readonly manifestId: string;
  readonly manifestHash: string;
  readonly planHash: string;
  readonly network: PayoutNetwork;
  readonly mint: string;
  readonly treasuryAuthority: string;
  readonly sourceTokenAccount: string;
  readonly feePayer: string;
}

export function createPayoutState(identity: StateIdentity, now = new Date()): PayoutStateV1 {
  const timestamp = now.toISOString();
  return {
    schema: "capy.payout-state.v1",
    manifest_id: identity.manifestId,
    manifest_hash: identity.manifestHash,
    plan_hash: identity.planHash,
    network: identity.network,
    mint: identity.mint,
    treasury_authority: identity.treasuryAuthority,
    source_token_account: identity.sourceTokenAccount,
    fee_payer: identity.feePayer,
    created_at: timestamp,
    updated_at: timestamp,
    batches: []
  };
}

export function assertStateIdentity(state: PayoutStateV1, identity: StateIdentity): void {
  const fields: ReadonlyArray<[string, string, string]> = [
    ["manifest_id", state.manifest_id, identity.manifestId],
    ["manifest_hash", state.manifest_hash, identity.manifestHash],
    ["plan_hash", state.plan_hash, identity.planHash],
    ["network", state.network, identity.network],
    ["mint", state.mint, identity.mint],
    ["treasury_authority", state.treasury_authority, identity.treasuryAuthority],
    ["source_token_account", state.source_token_account, identity.sourceTokenAccount],
    ["fee_payer", state.fee_payer, identity.feePayer]
  ];
  for (const [field, actual, expected] of fields) {
    if (actual !== expected) {
      throw new Error(`state ${field} mismatch; refusing to mix payout runs`);
    }
  }
}

export interface StateStore {
  load(): Promise<PayoutStateV1 | undefined>;
  save(state: PayoutStateV1): Promise<void>;
}

export class FileStateStore implements StateStore {
  readonly #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  async load(): Promise<PayoutStateV1 | undefined> {
    try {
      const file = await stat(this.#path);
      if ((file.mode & 0o077) !== 0) {
        throw new Error("payout state file permissions are too broad; require mode 0600 or stricter");
      }
      const contents = await readFile(this.#path, "utf8");
      return payoutStateSchema.parse(JSON.parse(contents) as unknown);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async save(state: PayoutStateV1): Promise<void> {
    const updated: PayoutStateV1 = {
      ...state,
      updated_at: new Date().toISOString()
    };
    payoutStateSchema.parse(updated);
    const parent = dirname(this.#path);
    await mkdir(parent, { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.#path}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    const temporary = await open(temporaryPath, "wx", 0o600);
    try {
      await temporary.writeFile(`${JSON.stringify(updated, null, 2)}\n`, "utf8");
      await temporary.sync();
    } finally {
      await temporary.close();
    }
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, this.#path);
    await chmod(this.#path, 0o600);
    const directory = await open(parent, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
    Object.assign(state, updated);
  }
}

export class MemoryStateStore implements StateStore {
  state: PayoutStateV1 | undefined;

  async load(): Promise<PayoutStateV1 | undefined> {
    return this.state === undefined
      ? undefined
      : payoutStateSchema.parse(structuredClone(this.state));
  }

  async save(state: PayoutStateV1): Promise<void> {
    state.updated_at = new Date().toISOString();
    this.state = payoutStateSchema.parse(structuredClone(state));
  }
}
