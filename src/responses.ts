import { GyroFundV1__factory, GyroLib__factory } from "@gyrostable/core";
import { ContractReceipt, ContractTransaction } from "ethers";
import MonetaryAmount from "./monetary-amount";
import { Optional } from "./types";
import { extractEventValue } from "./utils";

export interface MintResult {
  amountMinted: MonetaryAmount;
  mintReceipt: ContractReceipt;
  approveReceipts: ContractReceipt[];
}

export interface RedeemResult {
  amountRedeemed: MonetaryAmount;
  redeemReceipt: ContractReceipt;
  approveReceipt: Optional<ContractReceipt>;
}

const contractInterfaces = [GyroLib__factory, GyroFundV1__factory].map((f) => new f().interface);

export class MintTransactionResponse {
  constructor(readonly tx: ContractTransaction, readonly approveTxs: ContractTransaction[]) {}

  async wait(confirmations?: number): Promise<MintResult> {
    const allTxs = [this.tx].concat(this.approveTxs).map((t) => t.wait(confirmations));

    const [mintReceipt, ...approveReceipts] = await Promise.all(allTxs);
    const amount = extractEventValue(mintReceipt, "Mint", "amount", 0, ...contractInterfaces);
    return {
      amountMinted: new MonetaryAmount(amount),
      mintReceipt,
      approveReceipts,
    };
  }
}

export class RedeemTransactionResponse {
  constructor(
    readonly tx: ContractTransaction,
    readonly approveTx: Optional<ContractTransaction>
  ) {}

  async wait(confirmations?: number): Promise<RedeemResult> {
    const allTxs = [this.tx];
    if (this.approveTx) {
      allTxs.push(this.approveTx);
    }
    const allReceipts = allTxs.map((t) => t.wait(confirmations));
    const [redeemReceipt, approveReceipt] = await Promise.all(allReceipts);
    const amount = extractEventValue(redeemReceipt, "Redeem", "amount", 0, ...contractInterfaces);
    return {
      amountRedeemed: new MonetaryAmount(amount),
      redeemReceipt,
      approveReceipt,
    };
  }
}
