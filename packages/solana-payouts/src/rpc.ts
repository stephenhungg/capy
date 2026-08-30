import {
  fetchAllMaybeToken,
  fetchMaybeMint,
  getTokenSize,
  TOKEN_PROGRAM_ADDRESS
} from "@solana-program/token";
import {
  createSolanaRpc,
  getBase64Decoder,
  getBase64EncodedWireTransaction,
  signature,
  type Address,
  type Transaction,
  type TransactionMessageBytesBase64
} from "@solana/kit";

export interface RpcSignatureStatus {
  readonly err: unknown | null;
  readonly confirmationStatus: "processed" | "confirmed" | "finalized" | null;
}

export interface RpcMintAccount {
  readonly programAddress: Address;
  readonly decimals: number;
}

export interface RpcTokenAccount {
  readonly exists: boolean;
  readonly programAddress?: Address;
  readonly mint?: Address;
  readonly owner?: Address;
  readonly amount?: bigint;
}

export interface PayoutRpc {
  getGenesisHash(): Promise<string>;
  getLatestBlockhash(
    commitment: "confirmed" | "finalized"
  ): Promise<{ blockhash: string; lastValidBlockHeight: bigint }>;
  getSignatureStatuses(signatures: readonly string[]): Promise<Array<RpcSignatureStatus | null>>;
  getBlockHeight(): Promise<bigint>;
  getMintAccount(address: Address): Promise<RpcMintAccount | null>;
  getTokenAccounts(addresses: readonly Address[]): Promise<RpcTokenAccount[]>;
  getBalance(address: Address): Promise<bigint>;
  getTokenAccountRent(): Promise<bigint>;
  getFeeForTransaction(transaction: Transaction): Promise<bigint | null>;
  simulateTransaction(
    transaction: Transaction
  ): Promise<{ err: unknown | null; unitsConsumed?: bigint }>;
  sendTransaction(transaction: Transaction): Promise<string>;
}

export class KitRpcClient implements PayoutRpc {
  readonly #rpc: ReturnType<typeof createSolanaRpc>;

  constructor(rpcUrl: string) {
    this.#rpc = createSolanaRpc(rpcUrl);
  }

  async getGenesisHash(): Promise<string> {
    return this.#rpc.getGenesisHash().send();
  }

  async getLatestBlockhash(commitment: "confirmed" | "finalized") {
    const response = await this.#rpc.getLatestBlockhash({ commitment }).send();
    return {
      blockhash: response.value.blockhash,
      lastValidBlockHeight: response.value.lastValidBlockHeight
    };
  }

  async getSignatureStatuses(signatures: readonly string[]): Promise<Array<RpcSignatureStatus | null>> {
    const response = await this.#rpc
      .getSignatureStatuses(signatures.map((value) => signature(value)), {
        searchTransactionHistory: true
      })
      .send();
    return response.value.map((status) =>
      status === null
        ? null
        : {
            err: status.err,
            confirmationStatus: status.confirmationStatus
          }
    );
  }

  async getBlockHeight(): Promise<bigint> {
    return this.#rpc.getBlockHeight({ commitment: "confirmed" }).send();
  }

  async getMintAccount(mintAddress: Address): Promise<RpcMintAccount | null> {
    const account = await fetchMaybeMint(this.#rpc, mintAddress, { commitment: "confirmed" });
    return account.exists
      ? { programAddress: account.programAddress, decimals: account.data.decimals }
      : null;
  }

  async getTokenAccounts(addresses: readonly Address[]): Promise<RpcTokenAccount[]> {
    if (addresses.length === 0) return [];
    const result: RpcTokenAccount[] = [];
    for (let index = 0; index < addresses.length; index += 100) {
      const accounts = await fetchAllMaybeToken(this.#rpc, addresses.slice(index, index + 100), {
        commitment: "confirmed"
      });
      result.push(
        ...accounts.map((account) =>
          account.exists
            ? {
                exists: true,
                programAddress: account.programAddress,
                mint: account.data.mint,
                owner: account.data.owner,
                amount: account.data.amount
              }
            : { exists: false }
        )
      );
    }
    return result;
  }

  async getBalance(accountAddress: Address): Promise<bigint> {
    const response = await this.#rpc
      .getBalance(accountAddress, { commitment: "confirmed" })
      .send();
    return response.value;
  }

  async getTokenAccountRent(): Promise<bigint> {
    return this.#rpc
      .getMinimumBalanceForRentExemption(BigInt(getTokenSize()), { commitment: "confirmed" })
      .send();
  }

  async getFeeForTransaction(transaction: Transaction): Promise<bigint | null> {
    const encoded = getBase64Decoder().decode(
      transaction.messageBytes
    ) as TransactionMessageBytesBase64;
    const response = await this.#rpc
      .getFeeForMessage(encoded, { commitment: "confirmed" })
      .send();
    return response.value;
  }

  async simulateTransaction(transaction: Transaction) {
    const encoded = getBase64EncodedWireTransaction(transaction);
    const response = await this.#rpc
      .simulateTransaction(encoded, {
        commitment: "confirmed",
        encoding: "base64",
        sigVerify: true
      })
      .send();
    return {
      err: response.value.err,
      ...(response.value.unitsConsumed === undefined
        ? {}
        : { unitsConsumed: response.value.unitsConsumed })
    };
  }

  async sendTransaction(transaction: Transaction): Promise<string> {
    const encoded = getBase64EncodedWireTransaction(transaction);
    return this.#rpc
      .sendTransaction(encoded, {
        encoding: "base64",
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3n
      })
      .send();
  }
}

export function assertOriginalTokenProgram(programAddress: Address): void {
  if (programAddress !== TOKEN_PROGRAM_ADDRESS) {
    throw new Error("account is not owned by the original SPL Token program");
  }
}
