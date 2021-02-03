import {
  deployment,
  ERC20,
  ERC20__factory as ERC20Factory,
  GyroFund,
  GyroFundV1__factory as GyroFundV1Factory,
  GyroLib,
  GyroLib__factory as GyroLibFactory,
} from "@gyrostable/core";
import { BigNumber, BigNumberish, ContractTransaction, providers, Signer } from "ethers";
import { DECIMALS } from "./constants";
import MonetaryAmount from "./monetary-amount";
import { MintTransactionResponse, RedeemTransactionResponse } from "./responses";
import { Address, TokenWithAmount, Token } from "./types";

const contracts = deployment.contracts;

/**
 * Main entrypoint to communicate with the Gyro protocol
 * Allows to easily mint and redeem Gyro tokens
 */
export default class Gyro {
  private signer: Signer;
  private gyroFund: GyroFund;
  private gyroLib: GyroLib;

  /**
   * Creates a new `Gyro` instance
   *
   * @param provider a provider for ethers, can be constructed from `ethereum`
   *                 object with `new ethers.providers.Web3Provider(window.ethereum)`
   * @returns a `Gyro` instance
   */
  static async create(provider: providers.JsonRpcProvider, address?: Address) {
    if (!address) {
      address = await provider.getSigner().getAddress();
    }
    return new Gyro(provider, address);
  }

  private constructor(private provider: providers.JsonRpcProvider, private _address: Address) {
    this.signer = provider.getSigner(_address);
    this.gyroFund = GyroFundV1Factory.connect(contracts.GyroFundV1.address, this.signer);
    this.gyroLib = GyroLibFactory.connect(contracts.GyroLib.address, this.signer);
  }

  get address(): Address {
    return this._address;
  }

  /**
   * Changes the account used to access Gyro contract
   *
   * @param address address of the account to use
   */
  changeAccount(address: Address) {
    this.signer = this.provider.getSigner(address);
    this.gyroFund = this.gyroFund.connect(this.signer);
    this.gyroLib = this.gyroLib.connect(this.signer);
  }

  /**
   * Mints at lest `minMinted` Gyro given `inputs`
   *
   * @param inputs an array of input tokens to be used for minting
   * @param minMinted the minimum amount of Gyro to be minted, to let the caller decide on maximum slippage
   * @param approveFuture whether to approve the library to transfer the minimum amount to mint
   *                      or a large amount to avoid needing to approve again for future mints
   */
  async mint(
    inputs: TokenWithAmount[],
    minMinted: MonetaryAmount = MonetaryAmount.fromNormalized(0),
    approveFuture: boolean = true
  ): Promise<MintTransactionResponse> {
    const approveTxs = await this.approveTokensForLib(inputs, approveFuture);
    const tokensIn = inputs.map((i) => i.token);
    const amountsIn = inputs.map((i) => this.numberFromTokenAmount(i.amount));

    const tx = await this.gyroLib.mintFromUnderlyingTokens(tokensIn, amountsIn, minMinted.value);
    return new MintTransactionResponse(tx, approveTxs);
  }

  /**
   * Reddem at most `maxRedeemed` Gyro into given `outputs`
   *
   * @param ouputs an array of input tokens to be used for minting
   * @param maxRedeemed the maximum amount of Gyro to be redeemed, to let the caller decide on maximum slippage
   * @param approveFuture whether to approve the library to transfer the minimum amount to mint
   *                      or a large amount to avoid needing to approve again for future mints
   */
  async redeem(
    outputs: TokenWithAmount[],
    maxRedeemed: MonetaryAmount = MonetaryAmount.fromNormalized(0),
    approveFuture: boolean = true
  ): Promise<RedeemTransactionResponse> {
    const approveAmount = approveFuture ? BigNumber.from(10).pow(50) : maxRedeemed.value;
    const approveTx = await this.gyroFund.approve(this.gyroLib.address, approveAmount);

    const tokensOut = outputs.map((o) => o.token);
    const amountsOut = outputs.map((o) => this.numberFromTokenAmount(o.amount));

    const tx = await this.gyroLib.redeemToUnderlyingTokens(
      tokensOut,
      amountsOut,
      maxRedeemed.value
    );
    return new RedeemTransactionResponse(tx, approveTx);
  }

  /**
   * Estimates how much Gyro can be minted given `inputs`
   *
   * @param inputs an array of input coins to be used for minting
   * @return the expected amount of Gyro to be minted for `inputs`
   */
  async estimateMinted(inputs: TokenWithAmount[]): Promise<MonetaryAmount> {
    const tokensIn = inputs.map((i) => i.token);
    const amountsIn = inputs.map((i) => this.numberFromTokenAmount(i.amount));
    const amount = await this.gyroLib.estimateMintedGyro(tokensIn, amountsIn);
    return new MonetaryAmount(amount, DECIMALS);
  }

  /**
   * Estimates how much Gyro can will be redeemed given `inputs`
   *
   * @param outputs an array of input coins to be used for minting
   * @return the expected amount of Gyro to be minted for `outputs`
   */
  async estimateRedeemed(outputs: TokenWithAmount[]): Promise<MonetaryAmount> {
    const tokensOut = outputs.map((o) => o.token);
    const amountsOut = outputs.map((o) => this.numberFromTokenAmount(o.amount));
    const amount = await this.gyroLib.estimateRedeemedGyro(tokensOut, amountsOut);
    return new MonetaryAmount(amount, DECIMALS);
  }

  /**
   * Returns the Gyro balance of the current user
   *
   * @returns balance of the user as a `MonetaryAmount`
   */
  async balance(): Promise<MonetaryAmount> {
    const balance = await this.gyroFund.balanceOf(this._address);
    return new MonetaryAmount(balance, DECIMALS);
  }

  /**
   * Returns the balance of `token` of the current user
   *
   * @param token ERC20 token for which to retrieve balance
   * @returns balance of the user as a `MonetaryAmount`
   */
  async tokenBalance(token: Address | Token): Promise<MonetaryAmount> {
    let contract: ERC20;
    let decimals: number;

    if (typeof token === "string") {
      contract = ERC20Factory.connect(token, this.signer);
      decimals = await contract.decimals();
    } else {
      contract = ERC20Factory.connect(token.address, this.signer);
      decimals = token.decimals;
    }

    const balance = await contract.balanceOf(this.address);
    return new MonetaryAmount(balance, decimals);
  }

  getSupportedTokensAddresses(): Promise<Address[]> {
    return this.gyroLib.getSupportedTokens();
  }

  async getSupportedTokens(): Promise<Token[]> {
    const supportedAddresses = await this.getSupportedTokensAddresses();
    console.log(supportedAddresses);
    return Promise.all(
      supportedAddresses.map(async (address) => {
        const contract = ERC20Factory.connect(address, this.signer);
        const [name, symbol, decimals] = await Promise.all([
          contract.name(),
          contract.symbol(),
          contract.decimals(),
        ]);
        return {
          address,
          name,
          symbol,
          decimals,
        };
      })
    );
  }

  private async approveTokensForLib(
    inputs: TokenWithAmount[],
    approveFuture: boolean = true
  ): Promise<ContractTransaction[]> {
    const ercs = inputs.map((i) => ERC20Factory.connect(i.token, this.signer));
    const allowances = await Promise.all(
      ercs.map((erc) => erc.allowance(this._address, this.gyroLib.address))
    );

    const approveTxs: ContractTransaction[] = [];
    for (let i = 0; i < ercs.length; i++) {
      const inputAmount = this.numberFromTokenAmount(inputs[i].amount);

      if (allowances[i].lt(inputAmount)) {
        const approveAmount = approveFuture
          ? BigNumber.from(10).pow(50)
          : this.numberFromTokenAmount(inputAmount);
        const tx = await ercs[i].approve(this.gyroLib.address, approveAmount);
        approveTxs.push(tx);
      }
    }
    return approveTxs;
  }

  private numberFromTokenAmount(amount: BigNumberish | MonetaryAmount): BigNumber {
    if (amount instanceof MonetaryAmount) {
      return amount.value;
    } else {
      return BigNumber.from(amount);
    }
  }
}
