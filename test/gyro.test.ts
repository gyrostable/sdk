import { BigNumber, ethers } from "ethers";
import { Gyro } from "../src";
import { deployment } from "@gyrostable/core";
import { expect } from "chai";
import { isAddress } from "ethers/lib/utils";

const contracts = deployment.contracts;

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
      const balanceBefore = (await gyro.balance()).value;
      const mintResponse = await gyro.mint(inputs);
      const balanceAfter = (await gyro.balance()).value;
      const mintResult = await mintResponse.wait();
      expect(mintResult.amountMinted.isZero()).to.be.false;
      expect(balanceAfter.sub(balanceBefore).eq(mintResult.amountMinted.value)).to.be.true;
    });
  });

  describe("getSupportedTokensAddresses", () => {
    it("should return all the tokens supported by gyro", async () => {
      const tokenAddresses = await gyro.getSupportedTokensAddresses();
      expect(tokenAddresses).to.not.be.empty;
      expect(isAddress(tokenAddresses[0])).to.be.true;
    });
  });

  describe("getSupportedTokens", () => {
    it("should return all the tokens supported by gyro with their metadata", async () => {
      const tokens = await gyro.getSupportedTokens();
      expect(tokens).to.not.be.empty;
      expect(isAddress(tokens[0].address)).to.be.true;
      const usdt = tokens.find((v) => v.symbol === "USDT")!!;
      expect(usdt.decimals).to.eq(6);

      const dai = tokens.find((v) => v.symbol === "DAI")!!;
      expect(dai.decimals).to.eq(18);
    });
  });
});
