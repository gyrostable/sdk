import {
  BalancerExternalTokenRouter,
  BalancerExternalTokenRouter__factory,
  GyroFund,
  GyroFundV1__factory,
  ERC20__factory,
} from "@gyrostable/core/typechain";
import { BigNumber, providers } from "ethers";
import contracts from "./contracts";
import { InputCoin } from "./types";

export default class Gyro {
  private gyroFund: GyroFund;
  private balancerExternalTokenRouter: BalancerExternalTokenRouter;

  constructor(private provider: providers.JsonRpcProvider) {
    this.gyroFund = GyroFundV1__factory.connect(contracts.GyroFundV1.address, provider);
    this.balancerExternalTokenRouter = BalancerExternalTokenRouter__factory.connect(
      contracts.BalancerExternalTokenRouter,
      provider
    );
  }

  async mint(inputs: InputCoin[], minMinted: number = 0) {
    for (const input of inputs) {
      const erc = ERC20__factory.connect(input.token, this.provider);
      await erc.approve(this.balancerExternalTokenRouter.address, input.amount);
    }

    const tokensIn = inputs.map((i) => i.token);
    const amountsIn = inputs.map((i) => i.amount);
    const tx = await this.balancerExternalTokenRouter.deposit(tokensIn, amountsIn);
    const receipt = await tx.wait();
    if (!receipt.logs[0]) {
      throw new Error("log not found");
    }
    const evt = this.balancerExternalTokenRouter.interface.parseLog(receipt.logs[0]);
    const addresses: string[] = evt.args.bpAddresses;
    const amounts: BigNumber[] = evt.args.bpAmounts;

    const uniqueAmounts: Record<string, BigNumber> = {};
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      if (!(address in uniqueAmounts)) {
        uniqueAmounts[address] = BigNumber.from(0);
      }
      uniqueAmounts[address] = uniqueAmounts[address].add(amounts[i]);
    }

    const mintAddresses: string[] = [];
    const mintAmounts: BigNumber[] = [];
    for (const address in uniqueAmounts) {
      mintAddresses.push(address);
      mintAmounts.push(uniqueAmounts[address]);
    }

    await this.gyroFund.mint(mintAddresses, mintAmounts, minMinted);
  }
}
