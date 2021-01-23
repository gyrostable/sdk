import { BigNumber, BigNumberish, ContractReceipt } from "ethers";

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

export interface Token {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Wrapper around `BigNumber` to express a monetary amount
 *
 * For doing computation on the amount, the underlying value can be retrieved using `value`
 * For displaying, the `toNormalizedXXX()` returns a representation without the decimals
 */
export class MonetaryAmount {
  private scale: BigNumber;
  readonly value: BigNumber;

  constructor(_value: BigNumberish, readonly decimals: number) {
    this.value = BigNumber.from(_value);
    this.scale = BigNumber.from(10).pow(decimals);
  }

  /**
   * Amount after dividing by the decimal scale
   * @returns normalized amount
   */
  get normalizedValue(): BigNumber {
    return this.value.div(this.scale);
  }

  toNormalizedNumber() {
    return this.normalizedValue.toNumber();
  }

  toNormalizedString() {
    return this.normalizedValue.toString();
  }

  toString() {
    return this.value.toString();
  }
}
