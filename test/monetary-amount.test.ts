import { expect } from "chai";
import { BigNumber } from "ethers";
import MonetaryAmount from "../src/monetary-amount";

describe("types", () => {
  describe("MonetaryAmount", () => {
    const million = 1_000_000;
    describe("value", () => {
      it("should return the raw value", () => {
        expect(new MonetaryAmount(million, 3).value.eq(BigNumber.from(million))).to.be.true;
      });
    });

    describe("normalizedValue", () => {
      it("should return normalized value", () => {
        expect(new MonetaryAmount(million, 3).normalizedValue.eq(BigNumber.from(1000))).to.be.true;
      });
    });

    describe("toNormalizedNumber", () => {
      it("should return normalized value as a number", () => {
        expect(new MonetaryAmount(million, 3).toNormalizedNumber()).to.eq(1000);
      });
    });

    describe("toNormalizedString", () => {
      it("should return normalized value as a string", () => {
        expect(new MonetaryAmount(million, 3).toNormalizedString()).to.eq("1000");
      });
    });
  });
});
