import { BigNumber, BigNumberish, ContractReceipt } from "ethers";

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

/**
 * Wrapper around `BigNumber` to express a monetary amount
 * "normalized" means that actual value (e.g. for ETH, n = n ETH) while the raw value is
 * the value scaled with the `decimals` (e.g. for ETH, n * 10^18 = n ETH)
 *
 * For doing computation on the amount, the underlying value can be retrieved using `value`
 * For displaying, the `toNormalizedXXX()` returns a representation without the decimals
 */
export class MonetaryAmount {
  private scale: BigNumber;
  readonly value: BigNumber;

  /**
   * Creates a `MonetaryAmount` from a raw value
   *
   * @param value the normalized value (i.e. for DAI, n * 10 ^ 18 means `n` DAI)
   * @param decimals the number of decimals for this currency (e.g. for DAI, this is 18)
   */
  constructor(_value: BigNumberish, readonly decimals: number) {
    this.value = BigNumber.from(_value);
    this.scale = BigNumber.from(10).pow(decimals);
  }

  /**
   * Creates a `MonetaryAmount` from a normalized value
   *
   * @param value the normalized value (i.e. for DAI, `n` means `n` DAI)
   * @param decimals the number of decimals for this currency (e.g. for DAI, this is 18)
   */
  static fromNormalized(value: BigNumberish, decimals: number) {
    const rawValue = BigNumber.from(value).mul(BigNumber.from(10).pow(decimals));
    return new MonetaryAmount(rawValue, decimals);
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
