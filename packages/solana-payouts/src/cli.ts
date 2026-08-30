#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { address, type Address } from "@solana/kit";
import { Command, Option } from "commander";
import {
  assertRpcEndpointAllowed,
  getNetworkPolicy,
  type PayoutNetwork
} from "./constants.js";
import {
  executePayoutPlan,
  reconcileState,
  stateToReconciliationJson,
  stateToSettlementJson
} from "./executor.js";
import { loadDevnetKeypair } from "./keypair.js";
import { validateManifest, type ValidatedManifest } from "./manifest.js";
import { assertClusterIdentity } from "./network.js";
import { createPayoutPlan, planToJson } from "./plan.js";
import { KitRpcClient } from "./rpc.js";
import { assertStateIdentity, FileStateStore } from "./state.js";

interface CommonOptions {
  network: PayoutNetwork;
  stateFile?: string;
  allowedRpcHost: string[];
}

interface RunOptions extends CommonOptions {
  treasuryAuthority?: string;
  treasuryKeypair?: string;
  feePayer?: string;
  feePayerKeypair?: string;
  sourceTokenAccount?: string;
  maxPayoutsPerBatch: string;
  priorityFeeMicroLamports: string;
  submit: boolean;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function readManifest(path: string): Promise<ValidatedManifest> {
  const contents = await readFile(path, "utf8");
  return validateManifest(JSON.parse(contents) as unknown);
}

function publicKey(value: string, label: string): Address {
  try {
    return address(value);
  } catch {
    throw new Error(`${label} is not a valid Solana public key`);
  }
}

function assertNetwork(manifest: ValidatedManifest, network: PayoutNetwork): void {
  if (manifest.manifest.network !== network) {
    throw new Error(
      `--network ${network} does not match manifest network ${manifest.manifest.network}`
    );
  }
}

function statePath(manifest: ValidatedManifest, configured?: string): string {
  return resolve(configured ?? `.capy-payout-state/${manifest.manifestHash}.json`);
}

function rpcConnection(options: CommonOptions): KitRpcClient {
  const policy = getNetworkPolicy(options.network);
  const rpcUrl = process.env.CAPY_SOLANA_RPC_URL ?? policy.officialRpcUrl;
  assertRpcEndpointAllowed(options.network, rpcUrl, options.allowedRpcHost);
  return new KitRpcClient(rpcUrl);
}

function addCommonOptions(command: Command): Command {
  return command
    .addOption(
      new Option("--network <network>", "explicit Solana cluster")
        .choices(["devnet", "mainnet-beta"])
        .makeOptionMandatory()
    )
    .option("--state-file <path>", "offchain write-ahead journal path")
    .option(
      "--allowed-rpc-host <host...>",
      "additional exact rpc hostnames allowed for CAPY_SOLANA_RPC_URL",
      []
    );
}

const program = new Command()
  .name("capy-solana-payouts")
  .description("devnet-first native USDC contributor payout rail")
  .showSuggestionAfterError()
  .showHelpAfterError();

program
  .command("validate")
  .description("validate and hash a versioned payout manifest without using rpc")
  .argument("<manifest>", "manifest json path")
  .action(async (manifestPath: string) => {
    const manifest = await readManifest(manifestPath);
    writeJson({
      schema: "capy.payout-validation.v1",
      valid: true,
      manifest_id: manifest.manifest.manifest_id,
      manifest_hash: manifest.manifestHash,
      network: manifest.manifest.network,
      mint: manifest.mint,
      payout_count: manifest.payouts.length,
      total_base_units: manifest.totalBaseUnits.toString()
    });
  });

const run = addCommonOptions(
  program
    .command("run")
    .description("plan offline by default; add --submit for an explicit devnet submission")
    .argument("<manifest>", "manifest json path")
    .option("--treasury-authority <public-key>", "treasury token authority for dry-run")
    .option("--treasury-keypair <path>", "0600 devnet treasury keypair file")
    .option("--fee-payer <public-key>", "sponsor public key for dry-run")
    .option("--fee-payer-keypair <path>", "0600 devnet sponsor keypair file")
    .option("--source-token-account <public-key>", "explicit treasury USDC token account")
    .option("--max-payouts-per-batch <count>", "additional operator batch cap", "8")
    .option(
      "--priority-fee-micro-lamports <amount>",
      "bounded priority price per compute unit",
      "0"
    )
    .option("--submit", "sign, journal, and submit; omitted means dry-run", false)
);

run.action(async (manifestPath: string, options: RunOptions) => {
  const manifest = await readManifest(manifestPath);
  assertNetwork(manifest, options.network);

  let treasuryAuthority: Address;
  let feePayer: Address;
  let treasurySigner;
  let feePayerSigner;
  if (options.submit) {
    const policy = getNetworkPolicy(options.network);
    if (!policy.submissionEnabled) {
      throw new Error(
        "mainnet submission is intentionally disabled in this scaffold; complete the mainnet-readiness checklist first"
      );
    }
    if (!options.treasuryKeypair) throw new Error("--treasury-keypair is required with --submit");
    treasurySigner = await loadDevnetKeypair(options.treasuryKeypair);
    feePayerSigner = options.feePayerKeypair
      ? await loadDevnetKeypair(options.feePayerKeypair)
      : treasurySigner;
    treasuryAuthority = treasurySigner.address;
    feePayer = feePayerSigner.address;
    if (
      options.treasuryAuthority &&
      treasuryAuthority !== publicKey(options.treasuryAuthority, "treasury authority")
    ) {
      throw new Error("--treasury-authority does not match --treasury-keypair");
    }
    if (options.feePayer && feePayer !== publicKey(options.feePayer, "fee payer")) {
      throw new Error("--fee-payer does not match --fee-payer-keypair");
    }
  } else {
    if (!options.treasuryAuthority) {
      throw new Error("--treasury-authority is required for a dry-run");
    }
    treasuryAuthority = publicKey(options.treasuryAuthority, "treasury authority");
    feePayer = options.feePayer
      ? publicKey(options.feePayer, "fee payer")
      : treasuryAuthority;
  }

  const plan = await createPayoutPlan(manifest, {
    treasuryAuthority,
    feePayer,
    ...(options.sourceTokenAccount
      ? { sourceTokenAccount: publicKey(options.sourceTokenAccount, "source token account") }
      : {}),
    maxPayoutsPerBatch: Number(options.maxPayoutsPerBatch),
    priorityFeeMicroLamports: BigInt(options.priorityFeeMicroLamports)
  });
  if (!options.submit) {
    writeJson(planToJson(plan));
    return;
  }

  if (!treasurySigner || !feePayerSigner) throw new Error("internal signer setup failure");
  const connection = rpcConnection(options);
  await assertClusterIdentity(connection, options.network);
  const store = new FileStateStore(statePath(manifest, options.stateFile));
  const state = await executePayoutPlan(connection, plan, store, {
    authority: treasurySigner,
    feePayer: feePayerSigner
  });
  writeJson(stateToSettlementJson(plan, state));
});

const reconcile = addCommonOptions(
  program
    .command("reconcile")
    .description("query chain history for every journaled signature; never signs or submits")
    .argument("<manifest>", "manifest json path")
);

reconcile.action(async (manifestPath: string, options: CommonOptions) => {
  const manifest = await readManifest(manifestPath);
  assertNetwork(manifest, options.network);
  const store = new FileStateStore(statePath(manifest, options.stateFile));
  const existing = await store.load();
  if (!existing) throw new Error("payout state file was not found");
  assertStateIdentity(existing, {
    manifestId: manifest.manifest.manifest_id,
    manifestHash: manifest.manifestHash,
    planHash: existing.plan_hash,
    network: manifest.manifest.network,
    mint: manifest.mint,
    treasuryAuthority: existing.treasury_authority,
    sourceTokenAccount: existing.source_token_account,
    feePayer: existing.fee_payer
  });
  const connection = rpcConnection(options);
  await assertClusterIdentity(connection, options.network);
  const state = await reconcileState(connection, existing, store);
  writeJson(stateToReconciliationJson(state));
});

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
});
