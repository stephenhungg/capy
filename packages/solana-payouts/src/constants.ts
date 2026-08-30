import { address, type Address } from "@solana/kit";

export type PayoutNetwork = "devnet" | "mainnet-beta";

export interface NetworkPolicy {
  readonly network: PayoutNetwork;
  readonly officialRpcUrl: string;
  readonly defaultAllowedRpcHosts: readonly string[];
  readonly usdcMint: Address;
  readonly explorerCluster: string;
  readonly submissionEnabled: boolean;
}

export const USDC_DECIMALS = 6;
export const MAX_LEGACY_TRANSACTION_BYTES = 1_232;
export const MAX_TRANSACTION_ACCOUNTS = 64;
export const MAX_COMPUTE_UNITS = 1_400_000;
export const DEFAULT_MAX_PAYOUTS_PER_BATCH = 8;
export const MAX_PRIORITY_FEE_MICRO_LAMPORTS = 100_000n;

export const NETWORK_POLICIES: Readonly<Record<PayoutNetwork, NetworkPolicy>> = {
  devnet: {
    network: "devnet",
    officialRpcUrl: "https://api.devnet.solana.com",
    defaultAllowedRpcHosts: ["api.devnet.solana.com"],
    usdcMint: address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
    explorerCluster: "devnet",
    submissionEnabled: true
  },
  "mainnet-beta": {
    network: "mainnet-beta",
    officialRpcUrl: "https://api.mainnet.solana.com",
    defaultAllowedRpcHosts: ["api.mainnet.solana.com"],
    usdcMint: address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    explorerCluster: "mainnet-beta",
    submissionEnabled: false
  }
};

export function getNetworkPolicy(network: PayoutNetwork): NetworkPolicy {
  return NETWORK_POLICIES[network];
}

export function assertRpcEndpointAllowed(
  network: PayoutNetwork,
  rpcUrl: string,
  additionalAllowedHosts: readonly string[] = []
): URL {
  let parsed: URL;
  try {
    parsed = new URL(rpcUrl);
  } catch {
    throw new Error("rpc url must be a valid absolute url");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("rpc url must use https");
  }
  if (parsed.username || parsed.password) {
    throw new Error("rpc url must not contain basic-auth credentials");
  }

  const allowed = new Set([
    ...getNetworkPolicy(network).defaultAllowedRpcHosts,
    ...additionalAllowedHosts.map((host) => host.trim().toLowerCase()).filter(Boolean)
  ]);
  if (!allowed.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      `rpc host ${parsed.hostname} is not allowlisted for ${network}; add the exact host explicitly`
    );
  }
  return parsed;
}
