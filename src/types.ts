import { BigNumber, BigNumberish, ContractReceipt } from "ethers";
import MonetaryAmount from "./monetary-amount";

export type Optional<T> = T | null;
export type Address = string;

export interface InputCoin {
  token: Address;
  amount: BigNumberish | MonetaryAmount;
}

export type MintResult = {
  amountMinted: BigNumber;
  mintReceipt: ContractReceipt;
  approveReceipts: ContractReceipt[];
};

export interface Token {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
}
