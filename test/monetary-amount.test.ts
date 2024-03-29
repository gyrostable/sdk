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

    describe("mul", () => {
      it("should multiply the monetary amount with a number", () => {
        expect(new MonetaryAmount(million, 3).mul(2).toNormalizedNumber()).to.eq(2000);
        expect(new MonetaryAmount(million, 3).mul(0.5).toNormalizedNumber()).to.eq(500);
        expect(new MonetaryAmount(million, 3).mul(0.15).toNormalizedNumber()).to.eq(150);
        const hundred18 = BigNumber.from(100).mul(BigNumber.from(10).pow(18));
        expect(new MonetaryAmount(hundred18, 18).mul(99.5).toNormalizedNumber()).to.eq(9950);
      });
    });
  });
});
