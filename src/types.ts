import { BigNumber } from "ethers";

export type Address = string;

export interface InputCoin {
  token: Address;
  amount: BigNumber;
}
