import { createHash, createPublicKey, verify } from "node:crypto";
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda } from "@solana-program/token";
import { address, type Address } from "@solana/kit";
import canonicalizeModule from "canonicalize";
import { z } from "zod";
import { formatUsdcAmount } from "./amount.js";
import { getNetworkPolicy, type PayoutNetwork } from "./constants.js";
import {
  validateManifest,
  type ProtocolAuthorizedTransfer,
  type ProtocolPayoutAuthorizationBinding,
  type ValidatedManifest
} from "./manifest.js";

const canonicalize = canonicalizeModule as unknown as (
  input: unknown
) => string | undefined;

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const integerStringSchema = z.string().regex(/^(?:0|[1-9][0-9]*)$/);
const base58AddressSchema = z
  .string()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/);

const objectReferenceSchema = z
  .object({
    object_id: z.string().min(1),
    object_type: z.enum([
      "capability_manifest",
      "episode_cohort",
      "evaluation_receipt",
      "attribution_result",
      "solana_payout_manifest"
    ]),
    object_digest: digestSchema
  })
  .strict();

const signatureSchema = z
  .object({
    algorithm: z.literal("Ed25519"),
    key_id: z.string().min(1),
    signed_digest: digestSchema,
    signature_base64url: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
    created_at: z.string().datetime({ offset: true })
  })
  .strict();

const transferSchema = z
  .object({
    transfer_id: z.string().min(1).max(128),
    allocation_id: z.string().min(1).max(128),
    contributor_id: z.string().min(1),
    recipient_owner: base58AddressSchema,
    recipient_token_account: base58AddressSchema,
    amount_base_units: integerStringSchema
  })
  .strict();

export const protocolPayoutManifestSchema = z
  .object({
    $schema: z.literal(
      "https://capy.network/schemas/v1/solana-payout-manifest.schema.json"
    ),
    protocol_version: z.literal("1.0.0"),
    schema_version: z.literal("1.0.0"),
    object_type: z.literal("solana_payout_manifest"),
    object_id: z.string().min(1),
    issued_at: z.string().datetime({ offset: true }),
    supersedes: objectReferenceSchema
      .refine((reference) => reference.object_type === "solana_payout_manifest")
      .optional(),
    payload: z
      .object({
        attribution_result: objectReferenceSchema.refine(
          (reference) => reference.object_type === "attribution_result"
        ),
        payout_authority: z
          .object({
            actor_id: z.string().min(1),
            role: z.literal("payout_authority"),
            key_id: z.string().min(1)
          })
          .strict(),
        cluster: z
          .object({
            name: z.enum(["mainnet-beta", "devnet", "testnet", "localnet"]),
            genesis_hash: base58AddressSchema,
            rpc_reference: z.string().url()
          })
          .strict(),
        asset: z
          .object({
            symbol: z.string().min(1).max(32),
            mint: base58AddressSchema,
            decimals: z.number().int().min(0).max(18),
            token_program: base58AddressSchema
          })
          .strict(),
        treasury: z
          .object({
            owner: base58AddressSchema,
            token_account: base58AddressSchema
          })
          .strict(),
        transfers: z.array(transferSchema).min(1).max(10_000),
        totals: z
          .object({
            transfer_count: z.number().int().min(1),
            amount_base_units: integerStringSchema
          })
          .strict(),
        transaction_plan: z
          .array(
            z
              .object({
                batch_id: z.string().min(1).max(128),
                transfer_ids: z.array(z.string().min(1).max(128)).min(1),
                instruction: z.literal("TransferChecked"),
                memo: z.null()
              })
              .strict()
          )
          .min(1),
        execution_policy: z
          .object({
            required_commitment: z.literal("finalized"),
            preflight: z.literal(true),
            recipient_account_validation: z.literal("mint-owner-token-program-match"),
            duplicate_prevention: z.literal("offchain-idempotency-ledger"),
            partial_batch_failure: z.literal("retry-unsettled-batches-only")
          })
          .strict(),
        settlement: z
          .object({
            state: z.enum(["planned", "submitted", "finalized", "failed", "cancelled"]),
            transactions: z.array(z.unknown())
          })
          .strict(),
        privacy: z
          .object({
            personal_data_onchain: z.literal(false),
            onchain_fields: z
              .array(
                z.enum(["wallet_addresses", "token_amounts", "transaction_signatures"])
              )
              .min(1)
          })
          .strict()
      })
      .strict(),
    integrity: z
      .object({
        canonicalization: z.literal("RFC8785"),
        hash_algorithm: z.literal("sha-256"),
        digest_scope: z.literal("object-without-integrity-or-signatures"),
        object_digest: digestSchema
      })
      .strict(),
    signatures: z.array(signatureSchema).min(1)
  })
  .strict();

export type ProtocolPayoutManifest = z.infer<typeof protocolPayoutManifestSchema>;
export type ProtocolPayoutSignature = z.infer<typeof signatureSchema>;

export interface ProtocolSignatureVerificationRequest {
  readonly authorizationObjectId: string;
  readonly authorizationDigest: `sha256:${string}`;
  readonly canonicalSignatureStatement: Uint8Array;
  readonly signature: ProtocolPayoutSignature;
}

export interface ProtocolPayoutAdapterOptions {
  readonly verifySignature: (
    request: ProtocolSignatureVerificationRequest
  ) => boolean | Promise<boolean>;
}

export interface ProtocolAuthorizedManifest extends ValidatedManifest {
  readonly authorization: ProtocolPayoutAuthorizationBinding;
}

export function verifyEd25519ProtocolSignature(
  canonicalSignatureStatement: Uint8Array,
  signatureBase64url: string,
  rawPublicKey: Uint8Array
): boolean {
  if (rawPublicKey.byteLength !== 32) {
    throw new Error("Ed25519 public key must be exactly 32 bytes");
  }
  const signatureBytes = Buffer.from(signatureBase64url, "base64url");
  if (signatureBytes.byteLength !== 64) {
    throw new Error("Ed25519 signature must decode to exactly 64 bytes");
  }
  const publicKey = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(rawPublicKey)]),
    format: "der",
    type: "spki"
  });
  return verify(
    null,
    canonicalSignatureStatement,
    publicKey,
    signatureBytes
  );
}

function digest(value: string): `sha256:${string}` {
  return value as `sha256:${string}`;
}

function publicKey(value: string, label: string): Address {
  try {
    return address(value);
  } catch {
    throw new Error(`${label} is not a valid Solana public key`);
  }
}

function protocolDigest(manifest: ProtocolPayoutManifest): {
  readonly canonical: string;
  readonly digest: `sha256:${string}`;
} {
  const { integrity: _integrity, signatures: _signatures, ...digestTarget } = manifest;
  const canonical = canonicalize(digestTarget);
  if (canonical === undefined) {
    throw new Error("protocol payout authorization could not be canonicalized");
  }
  return {
    canonical,
    digest: `sha256:${createHash("sha256").update(canonical).digest("hex")}`
  };
}

function canonicalSignatureStatement(
  signature: ProtocolPayoutSignature
): Uint8Array {
  const canonical = canonicalize({
    algorithm: signature.algorithm,
    created_at: signature.created_at,
    key_id: signature.key_id,
    signed_digest: signature.signed_digest
  });
  if (canonical === undefined) {
    throw new Error("protocol payout signature statement could not be canonicalized");
  }
  return new TextEncoder().encode(canonical);
}

function executionNetwork(name: ProtocolPayoutManifest["payload"]["cluster"]["name"]): PayoutNetwork {
  if (name !== "devnet" && name !== "mainnet-beta") {
    throw new Error(`protocol payout cluster ${name} is not supported by this rail`);
  }
  return name;
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) throw new Error(`duplicate ${label} at index ${index}: ${value}`);
    seen.add(value);
  });
}

function assertTransactionPlanConservation(manifest: ProtocolPayoutManifest): void {
  const transferIds = manifest.payload.transfers.map((transfer) => transfer.transfer_id);
  const plannedIds = manifest.payload.transaction_plan.flatMap((batch) => batch.transfer_ids);
  assertUnique(
    manifest.payload.transaction_plan.map((batch) => batch.batch_id),
    "transaction batch_id"
  );
  assertUnique(plannedIds, "planned transfer_id");
  if (plannedIds.length !== transferIds.length) {
    throw new Error("protocol transaction plan does not cover every authorized transfer exactly once");
  }
  const transferSet = new Set(transferIds);
  const missing = transferIds.find((transferId) => !plannedIds.includes(transferId));
  const unknown = plannedIds.find((transferId) => !transferSet.has(transferId));
  if (missing || unknown) {
    throw new Error(
      `protocol transaction plan transfer mismatch${missing ? `; missing ${missing}` : ""}${unknown ? `; unknown ${unknown}` : ""}`
    );
  }
}

function payoutId(
  authorizationDigest: `sha256:${string}`,
  transferId: string
): string {
  return `pay_${createHash("sha256")
    .update(`${authorizationDigest}\u0000${transferId}`)
    .digest("hex")
    .slice(0, 32)}`;
}

function manifestId(
  objectId: string,
  authorizationDigest: `sha256:${string}`
): string {
  return `pm_${createHash("sha256")
    .update(`${objectId}\u0000${authorizationDigest}`)
    .digest("hex")
    .slice(0, 32)}`;
}

export function assertProtocolAuthorizationProjection(manifest: ValidatedManifest): void {
  const authorization = manifest.authorization;
  if (authorization.source !== "protocol-payout-manifest") {
    throw new Error("rail manifest is not bound to a protocol payout authorization");
  }

  assertUnique(
    authorization.transfers.map((transfer) => transfer.transferId),
    "authorization transfer_id"
  );
  assertUnique(
    authorization.transfers.map((transfer) => transfer.allocationId),
    "authorization allocation_id"
  );
  assertUnique(
    authorization.transfers.map((transfer) => transfer.payoutId),
    "authorization payout_id"
  );

  const payouts = new Map(manifest.payouts.map((payout) => [payout.payoutId, payout]));
  if (payouts.size !== authorization.transfers.length) {
    throw new Error("rail payout count does not match the protocol authorization");
  }

  let authorizedTotal = 0n;
  for (const transfer of authorization.transfers) {
    const payout = payouts.get(transfer.payoutId);
    if (!payout) {
      throw new Error(`rail projection is missing authorized allocation ${transfer.allocationId}`);
    }
    if (payout.recipientWallet !== transfer.recipientWallet) {
      throw new Error(`rail wallet mismatch for authorized allocation ${transfer.allocationId}`);
    }
    if (payout.amountBaseUnits !== transfer.amountBaseUnits) {
      throw new Error(`rail amount mismatch for authorized allocation ${transfer.allocationId}`);
    }
    if (!transfer.contributorId) {
      throw new Error(`missing contributor_id for authorized allocation ${transfer.allocationId}`);
    }
    authorizedTotal += transfer.amountBaseUnits;
  }
  if (authorizedTotal !== manifest.totalBaseUnits) {
    throw new Error("rail total does not conserve the protocol-authorized amount");
  }
}

export async function adaptProtocolPayoutManifest(
  input: unknown,
  options: ProtocolPayoutAdapterOptions
): Promise<ProtocolAuthorizedManifest> {
  const protocol = protocolPayoutManifestSchema.parse(input);
  const computed = protocolDigest(protocol);
  const authorizationDigest = digest(protocol.integrity.object_digest);
  if (authorizationDigest !== computed.digest) {
    throw new Error(
      `protocol payout digest mismatch: expected ${computed.digest}, got ${authorizationDigest}`
    );
  }
  if (protocol.signatures.some((signature) => signature.signed_digest !== authorizationDigest)) {
    throw new Error("protocol payout signature is bound to a different digest");
  }

  const authorityKeyId = protocol.payload.payout_authority.key_id;
  const authoritySignatures = protocol.signatures.filter(
    (signature) => signature.key_id === authorityKeyId
  );
  if (authoritySignatures.length === 0) {
    throw new Error("protocol payout authority did not sign the authorization digest");
  }
  let signatureVerified = false;
  for (const signature of authoritySignatures) {
    if (
      await options.verifySignature({
        authorizationObjectId: protocol.object_id,
        authorizationDigest,
        canonicalSignatureStatement: canonicalSignatureStatement(signature),
        signature
      })
    ) {
      signatureVerified = true;
      break;
    }
  }
  if (!signatureVerified) {
    throw new Error("protocol payout authority signature verification failed");
  }

  if (protocol.payload.settlement.state !== "planned" || protocol.payload.settlement.transactions.length !== 0) {
    throw new Error("only an unsettled planned protocol payout can enter the execution rail");
  }

  const network = executionNetwork(protocol.payload.cluster.name);
  const policy = getNetworkPolicy(network);
  if (
    protocol.payload.asset.symbol !== "USDC" ||
    protocol.payload.asset.decimals !== 6 ||
    protocol.payload.asset.mint !== policy.usdcMint ||
    protocol.payload.asset.token_program !== TOKEN_PROGRAM_ADDRESS
  ) {
    throw new Error(`protocol payout asset is not native allowlisted USDC for ${network}`);
  }

  const transfers = protocol.payload.transfers;
  assertUnique(transfers.map((transfer) => transfer.transfer_id), "transfer_id");
  assertUnique(transfers.map((transfer) => transfer.allocation_id), "allocation_id");
  assertTransactionPlanConservation(protocol);

  if (protocol.payload.totals.transfer_count !== transfers.length) {
    throw new Error("protocol payout transfer_count does not match its transfers");
  }
  const amountValues = transfers.map((transfer) => BigInt(transfer.amount_base_units));
  if (amountValues.some((amount) => amount <= 0n)) {
    throw new Error("every protocol payout transfer must be greater than zero");
  }
  const totalBaseUnits = amountValues.reduce((total, amount) => total + amount, 0n);
  if (totalBaseUnits !== BigInt(protocol.payload.totals.amount_base_units)) {
    throw new Error("protocol payout amount does not conserve its declared total");
  }
  if (totalBaseUnits > (1n << 64n) - 1n) {
    throw new Error("protocol payout total exceeds the SPL Token u64 limit");
  }

  const treasuryAuthority = publicKey(protocol.payload.treasury.owner, "protocol treasury owner");
  const sourceTokenAccount = publicKey(
    protocol.payload.treasury.token_account,
    "protocol treasury token account"
  );
  const protocolTransfers: ProtocolAuthorizedTransfer[] = await Promise.all(
    transfers.map(async (transfer, index) => {
      const recipientWallet = publicKey(
        transfer.recipient_owner,
        `recipient_owner for transfer ${transfer.transfer_id}`
      );
      const recipientTokenAccount = publicKey(
        transfer.recipient_token_account,
        `recipient_token_account for transfer ${transfer.transfer_id}`
      );
      const [expectedTokenAccount] = await findAssociatedTokenPda({
        mint: policy.usdcMint,
        owner: recipientWallet,
        tokenProgram: TOKEN_PROGRAM_ADDRESS
      });
      if (recipientTokenAccount !== expectedTokenAccount) {
        throw new Error(
          `recipient token account mismatch for authorized allocation ${transfer.allocation_id}`
        );
      }
      return {
        payoutId: payoutId(authorizationDigest, transfer.transfer_id),
        transferId: transfer.transfer_id,
        allocationId: transfer.allocation_id,
        contributorId: transfer.contributor_id,
        recipientWallet,
        recipientTokenAccount,
        amountBaseUnits: amountValues[index]!
      };
    })
  );
  assertUnique(protocolTransfers.map((transfer) => transfer.payoutId), "derived payout_id");

  const railManifest = validateManifest({
    schema: "capy.payout-manifest.v1",
    manifest_id: manifestId(protocol.object_id, authorizationDigest),
    created_at: protocol.issued_at,
    network,
    currency: "USDC",
    mint: protocol.payload.asset.mint,
    decimals: 6,
    expected_total_usdc: formatUsdcAmount(totalBaseUnits),
    payouts: protocolTransfers.map((transfer) => ({
      payout_id: transfer.payoutId,
      recipient_wallet: transfer.recipientWallet,
      amount_usdc: formatUsdcAmount(transfer.amountBaseUnits)
    }))
  });
  const authorization: ProtocolPayoutAuthorizationBinding = {
    source: "protocol-payout-manifest",
    objectId: protocol.object_id,
    digest: authorizationDigest,
    attributionObjectId: protocol.payload.attribution_result.object_id,
    attributionDigest: digest(protocol.payload.attribution_result.object_digest),
    treasuryAuthority,
    sourceTokenAccount,
    transfers: protocolTransfers
  };
  const authorizedManifest: ProtocolAuthorizedManifest = {
    ...railManifest,
    authorization
  };
  assertProtocolAuthorizationProjection(authorizedManifest);
  return authorizedManifest;
}
