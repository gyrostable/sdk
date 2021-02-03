import { BigNumber, BigNumberish } from "ethers";
import { round } from "lodash";
import { DECIMALS } from "./constants";

/**
 * Wrapper around `BigNumber` to express a monetary amount
 * "normalized" means that actual value (e.g. for ETH, n = n ETH) while the raw value is
 * the value scaled with the `decimals` (e.g. for ETH, n * 10^18 = n ETH)
 *
 * For doing computation on the amount, the underlying value can be retrieved using `value`
 * For displaying, the `toNormalizedXXX()` returns a representation without the decimals
 */
export default class MonetaryAmount {
  private scale: BigNumber;
  readonly value: BigNumber;

  /**
   * Creates a `MonetaryAmount` from a raw value
   *
   * @param value the normalized value (i.e. for DAI, n * 10 ^ 18 means `n` DAI)
   * @param decimals the number of decimals for this currency (e.g. for DAI, this is 18)
   */
  constructor(_value: BigNumberish, readonly decimals: number = DECIMALS) {
    this.value = BigNumber.from(_value);
    this.scale = BigNumber.from(10).pow(decimals);
  }

  /**
   * Creates a `MonetaryAmount` from a normalized value
   *
   * @param value the normalized value (i.e. for DAI, `n` means `n` DAI)
   * @param decimals the number of decimals for this currency (e.g. for DAI, this is 18)
   */
  static fromNormalized(value: BigNumberish, decimals: number = DECIMALS) {
    const rawValue = BigNumber.from(value).mul(BigNumber.from(10).pow(decimals));
    return new MonetaryAmount(rawValue, decimals);
  }

  /**
   * Returns true if the amount is zero
   * @returns whether the amount is zero or not
   */
  isZero(): boolean {
    return this.eq(0);
  }

  /**
   * Compares the value with `other`
   * @param other number with which to compare
   * @throws if `other` is a MonetaryAmount with a different number of decimals
   * @returns -1 if the value is less, 0 if equal and 1 if greater
   */
  compare(other: BigNumberish | MonetaryAmount): number {
    let otherValue: BigNumberish;

    if (other instanceof MonetaryAmount) {
      if (this.decimals !== other.decimals) {
        throw new Error("cannot compare monetary amount with different number of decimals");
      }
      otherValue = other.value;
    } else {
      otherValue = other;
    }

    return this.value.lt(otherValue) ? -1 : this.value.eq(otherValue) ? 0 : 1;
  }

  /**
   * Returns true if the value is equal to `other`
   * @param other number with which to compare
   * @returns true if the value is equal
   */
  eq(other: BigNumberish | MonetaryAmount): boolean {
    return this.compare(other) === 0;
  }

  /**
   * Returns true if the value is greater to `other`
   * @param other number with which to compare
   * @returns true if the value is greater
   */
  gt(other: BigNumberish | MonetaryAmount): boolean {
    return this.compare(other) === 1;
  }

  /**
   * Returns true if the value is greater or equal to `other`
   * @param other number with which to compare
   * @returns true if the value is greater or equal
   */
  gte(other: BigNumberish | MonetaryAmount): boolean {
    return this.compare(other) >= 0;
  }

  /**
   * Returns true if the value is less to `other`
   * @param other number with which to compare
   * @returns true if the value is less
   */
  lt(other: BigNumberish | MonetaryAmount): boolean {
    return this.compare(other) === -1;
  }

  /**
   * Returns true if the value is less or equal to `other`
   * @param other number with which to compare
   * @returns true if the value is less or equal
   */
  lte(other: BigNumberish | MonetaryAmount): boolean {
    return this.compare(other) <= 0;
  }

  /**
   * Multiplies `MonetaryAmount` with `value`
   * @param value number with which to multiply
   * @returns the multiplication result
   */
  mul(value: number): MonetaryAmount {
    if (Math.round(value) === value) {
      return new MonetaryAmount(this.value.mul(value), this.decimals);
    }
    const rounded = Math.round(value * Math.pow(10, this.decimals));
    const result = this.value.mul(rounded).div(BigNumber.from(10).pow(this.decimals));
    return new MonetaryAmount(result, this.decimals);
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
