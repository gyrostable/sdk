import { GyroFundV1__factory, GyroLib__factory } from "@gyrostable/core";
import { BigNumber, ContractReceipt, ContractTransaction } from "ethers";
import { Interface } from "ethers/lib/utils";
import { MonetaryAmount } from ".";
import { parseLogs } from "./utils";

export interface MintResult {
  amountMinted: MonetaryAmount;
  mintReceipt: ContractReceipt;
  approveReceipts: ContractReceipt[];
}

export class MintTransactionResponse {
  private contractInterfaces: Interface[];
  constructor(readonly tx: ContractTransaction, readonly approveTxs: ContractTransaction[]) {
    this.contractInterfaces = [GyroLib__factory, GyroFundV1__factory].map((f) => new f().interface);
  }

  async wait(confirmations?: number): Promise<MintResult> {
    const allTxs = [this.tx].concat(this.approveTxs).map((t) => t.wait(confirmations));

    const [mintReceipt, ...approveReceipts] = await Promise.all(allTxs);
    return {
      amountMinted: this.extractMintedAmount(mintReceipt),
      mintReceipt,
      approveReceipts,
    };
  }

  private extractMintedAmount(mintReceipt: ContractReceipt): MonetaryAmount {
    const events = parseLogs(mintReceipt, ...this.contractInterfaces);
    const mintEvent = events.find((evt) => evt.name === "Mint");
    const amount = mintEvent ? mintEvent.args.amount : BigNumber.from(0);
    return new MonetaryAmount(amount);
  }
}
