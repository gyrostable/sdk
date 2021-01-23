import { BigNumber, ContractReceipt } from "ethers";

export type Optional<T> = T | null;
export type Address = string;

export interface InputCoin {
  token: Address;
  amount: BigNumber;
}

export type MintResult = {
  amountMinted: BigNumber;
  mintReceipt: ContractReceipt;
  approveReceipts: ContractReceipt[];
};
