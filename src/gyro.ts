import {
  BPool,
  BPool__factory as BPoolFactory,
  BPool__factory,
  deployment,
  ERC20,
  ERC20__factory as ERC20Factory,
  ERC20__factory,
  GyroFundV1,
  GyroFundV1__factory as GyroFundV1Factory,
  GyroLib,
  GyroLib__factory as GyroLibFactory,
  MetaFaucet,
  MetaFaucet__factory as MetaFaucetFactory,
  GyroPriceOracle,
  GyroPriceOracle__factory as GyroPriceOracleFactory,
} from "@gyrostable/core";
import { BigNumber, BigNumberish, Contract, ContractTransaction, providers, Signer } from "ethers";
import DSProxyRegistryABI from "../abis/DSProxyRegistry.json";
import { DECIMALS } from "./constants";
import MonetaryAmount from "./monetary-amount";
import { MintTransactionResponse, RedeemTransactionResponse } from "./responses";
import { Address, Optional, Reserve, Token, TokenWithAmount } from "./types";

const { networks } = deployment;

const gasLimit: number = 2_000_000;
const gasPrice: number = 1_000_000_000;

// TODO: handle this properly
const kovanDsProxyRegistry = "0x130767E0cf05469CF11Fa3fcf270dfC1f52b9072";

/**
 * Main entrypoint to communicate with the Gyro protocol
 * Allows to easily mint and redeem Gyro tokens
 */
export default class Gyro {
  private signer: Signer;
  private gyroFund: GyroFundV1;
  private gyroLib: GyroLib;
  private metaFaucet: MetaFaucet;
  private sAmm: BPool;
  private GyroPriceOracle: GyroPriceOracle;
  private dsProxyRegistry: Contract;

  private static async getAddresses(
    provider: providers.JsonRpcProvider
  ): Promise<Record<string, string>> {
    const network = await provider.getNetwork();
    switch (network.chainId) {
      case 1337:
      case 31337:
        return networks.localhost;
      case 42:
        return networks.kovan;
      default:
        throw new Error(`network ${network.chainId} not supported`);
    }
  }

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
    const contractAddresses = await this.getAddresses(provider);
    return new Gyro(provider, address, contractAddresses);
  }

  private constructor(
    private provider: providers.JsonRpcProvider,
    private _address: Address,
    readonly contractAddresses: Record<string, string>
  ) {
    this.signer = provider.getSigner(_address);
    this.gyroFund = GyroFundV1Factory.connect(contractAddresses.GyroProxy, this.signer);
    this.gyroLib = GyroLibFactory.connect(contractAddresses.GyroLib, this.signer);
    this.sAmm = BPoolFactory.connect(contractAddresses["pool-gyd_usdc"], this.signer);
    this.metaFaucet = MetaFaucetFactory.connect(contractAddresses.MetaFaucet, this.signer);
    this.dsProxyRegistry = new Contract(kovanDsProxyRegistry, DSProxyRegistryABI, this.signer);
    this.GyroPriceOracle = GyroPriceOracleFactory.connect(
      contractAddresses.GyroPriceOracle,
      this.signer
    );
  }

  get address(): Address {
    return this._address;
  }

  getBalancerProxyAddress(): Promise<Address> {
    return this.dsProxyRegistry.proxies(this.address);
  }

  async metaMintUnderlying(): Promise<ContractTransaction> {
    return this.metaFaucet.mint();
  }

  async hasProvidedGydToSamm(): Promise<boolean> {
    const address = await this.getBalancerProxyAddress();
    const filter = this.sAmm.filters.LOG_JOIN(address, this.gyroFund.address, null);
    const events = await this.sAmm.queryFilter(filter);
    return events.length > 0;
  }

  async hasSwappedFromGydInSamm(): Promise<boolean> {
    const address = await this.getBalancerProxyAddress();
    const filter = this.sAmm.filters.LOG_SWAP(address, this.gyroFund.address, null, null, null);
    const events = await this.sAmm.queryFilter(filter);
    return events.length > 0;
  }

  async hasSwappedToGydInSamm(): Promise<boolean> {
    const address = await this.getBalancerProxyAddress();
    const filter = this.sAmm.filters.LOG_SWAP(address, null, this.gyroFund.address, null, null);
    const events = await this.sAmm.queryFilter(filter);
    return events.length > 0;
  }

  async hasMintedGyro(): Promise<boolean> {
    const filter = this.gyroLib.filters.Mint(this.address, null);
    const events = await this.gyroLib.queryFilter(filter);
    return events.length > 0;
  }

  async hasRedeemedGyro(): Promise<boolean> {
    const filter = this.gyroLib.filters.Redeem(this.address, null);
    const events = await this.gyroLib.queryFilter(filter);
    return events.length > 0;
  }

  async setUserTransactions(firstTx: string, secondTx: string) {
    this.GyroPriceOracle.setTransactions(firstTx, secondTx);
  }

  getUSDCValue(txReceipt: providers.TransactionReceipt): BigNumber {
    for (let txLogs of txReceipt.logs) {
      try {
        const parsedLog = this.gyroFund.interface.parseLog(txLogs);
        if (
          txLogs.address === this.contractAddresses["token-USDC"] &&
          parsedLog.name === "Transfer"
        ) {
          return parsedLog.args.value;
        }
      } catch (e) {
        continue;
      }
    }
    return BigNumber.from(0);
  }

  async verifyArbitrage(firstTx: string, secondTx: string): Promise<boolean> {
    const [firstTxReceipt, secondTxReceipt] = await Promise.all([
      this.provider.getTransactionReceipt(firstTx),
      this.provider.getTransactionReceipt(secondTx),
    ]);

    if (!firstTxReceipt || !secondTxReceipt) {
      return false;
    }

    const usdcInValue = this.getUSDCValue(firstTxReceipt);
    const usdcOutValue = this.getUSDCValue(secondTxReceipt);

    return usdcInValue.gt(0) && usdcOutValue.gt(usdcInValue);
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
   * Mints at least `minMinted` Gyro given `inputs`
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

    const tx = await this.gyroLib.mintFromUnderlyingTokens(tokensIn, amountsIn, minMinted.value, {
      gasLimit,
      gasPrice,
    });
    return new MintTransactionResponse(tx, approveTxs);
  }

  /**
   * Redeem at most `maxRedeemed` Gyro into given `outputs`
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
    const approved = await this.gyroFund.allowance(this._address, this.gyroLib.address);
    let approveTx: Optional<ContractTransaction> = null;

    if (approved.lt(maxRedeemed.value)) {
      approveTx = await this.gyroFund.approve(this.gyroLib.address, approveAmount);
    }

    const tokensOut = outputs.map((o) => o.token);
    const amountsOut = outputs.map((o) => this.numberFromTokenAmount(o.amount));

    const tx = await this.gyroLib.redeemToUnderlyingTokens(
      tokensOut,
      amountsOut,
      maxRedeemed.value,
      { gasLimit, gasPrice }
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
   * Returns the total supply of Gyro in circulation
   *
   * @returns total supply of Gyro as a `MonetaryAmount`
   */
  async totalSupply(): Promise<MonetaryAmount> {
    const totalSupply = await this.gyroFund.totalSupply();
    return new MonetaryAmount(totalSupply, DECIMALS);
  }

  /**
   * Returns the balance of `token` of the current user
   *
   * @param token ERC20 token for which to retrieve balance
   * @returns balance of the user as a `MonetaryAmount`
   */
  async tokenBalance(token: Address | Token, address?: Address): Promise<MonetaryAmount> {
    let contract: ERC20;
    let decimals: number;

    if (!address) {
      address = this.address;
    }

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

  get fundAddress(): Address {
    return this.gyroFund.address;
  }

  async getSupportedTokens(): Promise<Token[]> {
    const supportedAddresses = await this.getSupportedTokensAddresses();
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

  async getReserveValues(): Promise<Reserve[]> {
    const [errorCode, addresses, amounts] = await this.gyroLib.getReserveValues();
    const reserve: Reserve[] = [];

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const amount = new MonetaryAmount(amounts[i], 18);
      const tokens = await BPool__factory.connect(address, this.signer).getFinalTokens();
      const tokenSymbols = await Promise.all(
        tokens.map((t) => ERC20__factory.connect(t, this.signer).symbol())
      );

      reserve.push({ errorCode, address, amount, tokens, tokenSymbols });
    }

    return reserve;
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
        const tx = await ercs[i].approve(this.gyroLib.address, approveAmount, { gasPrice });
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
