import { BigNumber, ethers } from "ethers";
import { Gyro, contracts } from "../src";
import { expect } from "chai";

describe("Gyro", () => {
  let gyro: Gyro;

  beforeEach(async () => {
    const provider = new ethers.providers.JsonRpcProvider();
    gyro = await Gyro.create(provider);
  });

  describe("mint", () => {
    it("should mint Gyro", async () => {
      const inputs = [
        { token: contracts.DAIERC20.address, amount: BigNumber.from(10).pow(18).mul(2500) },
        { token: contracts.WETHERC20.address, amount: BigNumber.from(10).pow(18).mul(2) },
      ];
      const balanceBefore = await gyro.balance();
      const mintResult = await gyro.mint(inputs);
      const balanceAfter = await gyro.balance();
      expect(mintResult.amountMinted.isZero()).to.be.false;
      expect(balanceAfter.sub(balanceBefore).eq(mintResult.amountMinted)).to.be.true;
    });
  });
});
