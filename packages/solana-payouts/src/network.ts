import { getNetworkPolicy, type PayoutNetwork } from "./constants.js";
import { KitRpcClient } from "./rpc.js";

export interface GenesisHashRpc {
  getGenesisHash(): Promise<string>;
}

export async function assertClusterIdentity(
  rpc: GenesisHashRpc,
  network: PayoutNetwork,
  referenceRpc?: GenesisHashRpc
): Promise<string> {
  const policy = getNetworkPolicy(network);
  const reference =
    referenceRpc ?? new KitRpcClient(policy.officialRpcUrl);
  const [actualGenesisHash, expectedGenesisHash] = await Promise.all([
    rpc.getGenesisHash(),
    reference.getGenesisHash()
  ]);
  if (actualGenesisHash !== expectedGenesisHash) {
    throw new Error(
      `rpc genesis hash does not match the official ${network} endpoint; refusing to continue`
    );
  }
  return actualGenesisHash;
}
