import {
  createHash,
  generateKeyPairSync,
  sign as signEd25519
} from "node:crypto";
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda } from "@solana-program/token";
import {
  address,
  generateKeyPairSigner,
  getCompiledTransactionMessageDecoder
} from "@solana/kit";
import canonicalizeModule from "canonicalize";
import { describe, expect, it, vi } from "vitest";
import { loadOrCreateState } from "../src/executor.js";
import { createPayoutPlan, buildBatchTransaction, planToJson } from "../src/plan.js";
import {
  adaptProtocolPayoutManifest,
  assertProtocolAuthorizationProjection,
  verifyEd25519ProtocolSignature
} from "../src/protocol.js";
import { MemoryStateStore } from "../src/state.js";

const canonicalize = canonicalizeModule as unknown as (
  input: unknown
) => string | undefined;

async function fixture() {
  const [treasury, recipientA, recipientB] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner()
  ]);
  const mint = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  const [[treasuryTokenAccount], [recipientTokenAccountA], [recipientTokenAccountB]] =
    await Promise.all([
      findAssociatedTokenPda({ mint, owner: treasury.address, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
      findAssociatedTokenPda({ mint, owner: recipientA.address, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
      findAssociatedTokenPda({ mint, owner: recipientB.address, tokenProgram: TOKEN_PROGRAM_ADDRESS })
    ]);
  const body = {
    $schema: "https://capy.network/schemas/v1/solana-payout-manifest.schema.json",
    protocol_version: "1.0.0",
    schema_version: "1.0.0",
    object_type: "solana_payout_manifest",
    object_id: "urn:uuid:55555555-5555-4555-8555-555555555555",
    issued_at: "2026-08-30T20:00:00.000Z",
    payload: {
      attribution_result: {
        object_id: "urn:uuid:44444444-4444-4444-8444-444444444444",
        object_type: "attribution_result",
        object_digest: `sha256:${"4".repeat(64)}`
      },
      payout_authority: {
        actor_id: "urn:capy:actor:payout-service",
        role: "payout_authority",
        key_id: "urn:capy:key:payout-service-2026-01"
      },
      cluster: {
        name: "devnet",
        genesis_hash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
        rpc_reference: "https://api.devnet.solana.com"
      },
      asset: {
        symbol: "USDC",
        mint,
        decimals: 6,
        token_program: TOKEN_PROGRAM_ADDRESS
      },
      treasury: {
        owner: treasury.address,
        token_account: treasuryTokenAccount
      },
      transfers: [
        {
          transfer_id: "transfer-alpha",
          allocation_id: "allocation-alpha",
          contributor_id: "urn:capy:contributor:alpha",
          recipient_owner: recipientA.address,
          recipient_token_account: recipientTokenAccountA,
          amount_base_units: "750000"
        },
        {
          transfer_id: "transfer-beta",
          allocation_id: "allocation-beta",
          contributor_id: "urn:capy:contributor:beta",
          recipient_owner: recipientB.address,
          recipient_token_account: recipientTokenAccountB,
          amount_base_units: "250000"
        }
      ],
      totals: {
        transfer_count: 2,
        amount_base_units: "1000000"
      },
      transaction_plan: [
        {
          batch_id: "batch-001",
          transfer_ids: ["transfer-alpha", "transfer-beta"],
          instruction: "TransferChecked",
          memo: null
        }
      ],
      execution_policy: {
        required_commitment: "finalized",
        preflight: true,
        recipient_account_validation: "mint-owner-token-program-match",
        duplicate_prevention: "offchain-idempotency-ledger",
        partial_batch_failure: "retry-unsettled-batches-only"
      },
      settlement: {
        state: "planned",
        transactions: []
      },
      privacy: {
        personal_data_onchain: false,
        onchain_fields: ["wallet_addresses", "token_amounts", "transaction_signatures"]
      }
    }
  };
  return { body, treasury, recipientA, recipientB, treasuryTokenAccount };
}

function sign(body: object) {
  const canonical = canonicalize(body);
  if (canonical === undefined) throw new Error("test fixture could not be canonicalized");
  const digest = `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
  return {
    ...body,
    integrity: {
      canonicalization: "RFC8785",
      hash_algorithm: "sha-256",
      digest_scope: "object-without-integrity-or-signatures",
      object_digest: digest
    },
    signatures: [
      {
        algorithm: "Ed25519",
        key_id: "urn:capy:key:payout-service-2026-01",
        signed_digest: digest,
        signature_base64url: "A".repeat(86),
        created_at: "2026-08-30T20:00:01.000Z"
      }
    ]
  };
}

function cryptographicallySign(body: object) {
  const canonical = canonicalize(body);
  if (canonical === undefined) throw new Error("test fixture could not be canonicalized");
  const digest = `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
  const signatureStatement = canonicalize({
    algorithm: "Ed25519",
    created_at: "2026-08-30T20:00:01.000Z",
    key_id: "urn:capy:key:payout-service-2026-01",
    signed_digest: digest
  });
  if (signatureStatement === undefined) {
    throw new Error("test signature statement could not be canonicalized");
  }
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  const rawPublicKey = publicKeyDer.subarray(publicKeyDer.length - 32);
  const signature = signEd25519(
    null,
    Buffer.from(signatureStatement),
    privateKey
  ).toString("base64url");
  return {
    manifest: {
      ...body,
      integrity: {
        canonicalization: "RFC8785",
        hash_algorithm: "sha-256",
        digest_scope: "object-without-integrity-or-signatures",
        object_digest: digest
      },
      signatures: [
        {
          algorithm: "Ed25519",
          key_id: "urn:capy:key:payout-service-2026-01",
          signed_digest: digest,
          signature_base64url: signature,
          created_at: "2026-08-30T20:00:01.000Z"
        }
      ]
    },
    rawPublicKey
  };
}

describe("protocol payout authorization adapter", () => {
  it("verifies a real Ed25519 signature over the canonical protocol signature statement", async () => {
    const { body } = await fixture();
    const signed = cryptographicallySign(body);
    const manifest = await adaptProtocolPayoutManifest(signed.manifest, {
      verifySignature: (request) =>
        verifyEd25519ProtocolSignature(
          request.canonicalSignatureStatement,
          request.signature.signature_base64url,
          signed.rawPublicKey
        )
    });
    expect(manifest.authorization.source).toBe("protocol-payout-manifest");

    const tamperedPublicKey = Uint8Array.from(signed.rawPublicKey);
    tamperedPublicKey[0] = tamperedPublicKey[0]! ^ 1;
    await expect(
      adaptProtocolPayoutManifest(signed.manifest, {
        verifySignature: (request) =>
          verifyEd25519ProtocolSignature(
            request.canonicalSignatureStatement,
            request.signature.signature_base64url,
            tamperedPublicKey
          )
      })
    ).rejects.toThrow(/signature verification failed/);
  });

  it("projects every authorized allocation exactly and verifies the authority signature", async () => {
    const { body, treasury, recipientA, recipientB, treasuryTokenAccount } = await fixture();
    const verifySignature = vi.fn(() => true);
    const manifest = await adaptProtocolPayoutManifest(sign(body), { verifySignature });

    expect(verifySignature).toHaveBeenCalledOnce();
    const verificationRequest = verifySignature.mock.calls[0]?.[0];
    expect(verificationRequest).toBeDefined();
    expect(
      new TextDecoder().decode(
        verificationRequest?.canonicalSignatureStatement
      )
    ).toBe(
      canonicalize({
        algorithm: "Ed25519",
        created_at: "2026-08-30T20:00:01.000Z",
        key_id: "urn:capy:key:payout-service-2026-01",
        signed_digest: manifest.authorization.digest
      })
    );
    expect(manifest.authorization.source).toBe("protocol-payout-manifest");
    if (manifest.authorization.source !== "protocol-payout-manifest") {
      throw new Error("expected protocol authorization");
    }
    expect(manifest.authorization.objectId).toBe(body.object_id);
    expect(manifest.authorization.attributionObjectId).toBe(
      body.payload.attribution_result.object_id
    );
    expect(manifest.authorization.treasuryAuthority).toBe(treasury.address);
    expect(manifest.authorization.sourceTokenAccount).toBe(treasuryTokenAccount);
    expect(manifest.authorization.transfers).toEqual([
      expect.objectContaining({
        allocationId: "allocation-alpha",
        contributorId: "urn:capy:contributor:alpha",
        recipientWallet: recipientA.address,
        amountBaseUnits: 750_000n
      }),
      expect.objectContaining({
        allocationId: "allocation-beta",
        contributorId: "urn:capy:contributor:beta",
        recipientWallet: recipientB.address,
        amountBaseUnits: 250_000n
      })
    ]);
    expect(manifest.totalBaseUnits).toBe(1_000_000n);
    expect(() => assertProtocolAuthorizationProjection(manifest)).not.toThrow();

    const plan = await createPayoutPlan(manifest, {
      treasuryAuthority: treasury.address,
      feePayer: treasury.address
    });
    expect(plan.sourceTokenAccount).toBe(treasuryTokenAccount);
    expect(planToJson(plan)).toMatchObject({
      authorization_object_id: body.object_id,
      authorization_digest: manifest.authorization.digest,
      total_base_units: "1000000"
    });

    const transaction = buildBatchTransaction(plan, plan.batches[0]!, {
      recentBlockhash: "11111111111111111111111111111111",
      lastValidBlockHeight: 100n,
      computeUnitLimit: 200_000
    });
    const compiled = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
    expect(compiled.staticAccounts).toContain(TOKEN_PROGRAM_ADDRESS);
    expect(compiled.staticAccounts).not.toContain(
      address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
    );
  });

  it("rejects a signature that is not verified for the payout authority", async () => {
    const { body } = await fixture();
    await expect(
      adaptProtocolPayoutManifest(sign(body), { verifySignature: () => false })
    ).rejects.toThrow(/signature verification failed/);
  });

  it("rejects amount, allocation, transaction-plan, and wallet projection mismatches", async () => {
    const { body } = await fixture();
    const amountMismatch = structuredClone(body);
    amountMismatch.payload.transfers[0]!.amount_base_units = "750001";
    await expect(
      adaptProtocolPayoutManifest(sign(amountMismatch), { verifySignature: () => true })
    ).rejects.toThrow(/does not conserve/);

    const allocationMismatch = structuredClone(body);
    allocationMismatch.payload.transfers[1]!.allocation_id = "allocation-alpha";
    await expect(
      adaptProtocolPayoutManifest(sign(allocationMismatch), { verifySignature: () => true })
    ).rejects.toThrow(/duplicate allocation_id/);

    const planMismatch = structuredClone(body);
    planMismatch.payload.transaction_plan[0]!.transfer_ids = ["transfer-alpha"];
    await expect(
      adaptProtocolPayoutManifest(sign(planMismatch), { verifySignature: () => true })
    ).rejects.toThrow(/does not cover every authorized transfer/);

    const walletMismatch = structuredClone(body);
    walletMismatch.payload.transfers[0]!.recipient_token_account =
      body.payload.transfers[1]!.recipient_token_account;
    await expect(
      adaptProtocolPayoutManifest(sign(walletMismatch), { verifySignature: () => true })
    ).rejects.toThrow(/recipient token account mismatch/);
  });

  it("refuses plan inputs that diverge from the signed treasury or payout projection", async () => {
    const { body, treasury } = await fixture();
    const manifest = await adaptProtocolPayoutManifest(sign(body), {
      verifySignature: () => true
    });
    const attacker = await generateKeyPairSigner();
    await expect(
      createPayoutPlan(manifest, {
        treasuryAuthority: attacker.address,
        feePayer: attacker.address
      })
    ).rejects.toThrow(/treasury authority/);

    if (manifest.authorization.source !== "protocol-payout-manifest") {
      throw new Error("expected protocol authorization");
    }
    const tampered = {
      ...manifest,
      payouts: manifest.payouts.map((payout, index) =>
        index === 0 ? { ...payout, amountBaseUnits: payout.amountBaseUnits + 1n } : payout
      )
    };
    await expect(
      createPayoutPlan(tampered, {
        treasuryAuthority: treasury.address,
        feePayer: treasury.address
      })
    ).rejects.toThrow(/rail amount mismatch/);
  });

  it("binds replay state to both the authorization object and digest", async () => {
    const { body, treasury } = await fixture();
    const manifest = await adaptProtocolPayoutManifest(sign(body), {
      verifySignature: () => true
    });
    const plan = await createPayoutPlan(manifest, {
      treasuryAuthority: treasury.address,
      feePayer: treasury.address
    });
    const store = new MemoryStateStore();
    const state = await loadOrCreateState(plan, store);
    expect(state.authorization_object_id).toBe(manifest.authorization.objectId);
    expect(state.authorization_digest).toBe(manifest.authorization.digest);

    const changedObject = {
      ...manifest,
      authorization: {
        ...manifest.authorization,
        objectId: "urn:uuid:66666666-6666-4666-8666-666666666666"
      }
    };
    const changedObjectPlan = await createPayoutPlan(changedObject, {
      treasuryAuthority: treasury.address,
      feePayer: treasury.address
    });
    await expect(loadOrCreateState(changedObjectPlan, store)).rejects.toThrow(
      /authorization_object_id mismatch/
    );

    const changedDigest = {
      ...manifest,
      authorization: {
        ...manifest.authorization,
        digest: `sha256:${"f".repeat(64)}` as const
      }
    };
    const changedDigestPlan = await createPayoutPlan(changedDigest, {
      treasuryAuthority: treasury.address,
      feePayer: treasury.address
    });
    const digestStore = new MemoryStateStore();
    await loadOrCreateState(plan, digestStore);
    await expect(loadOrCreateState(changedDigestPlan, digestStore)).rejects.toThrow(
      /authorization_digest mismatch/
    );
  });
});
