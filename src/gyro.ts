import {
  ERC20,
  ERC20__factory as ERC20Factory,
  GyroFund,
  GyroFundV1__factory as GyroFundV1Factory,
  GyroLib,
  GyroLib__factory as GyroLibFactory,
} from "@gyrostable/core";
import {
  BigNumber,
  BigNumberish,
  ContractReceipt,
  ContractTransaction,
  providers,
  Signer,
} from "ethers";
import { deployment } from "@gyrostable/core";
import { Address, InputCoin, MintResult, MonetaryAmount, Token } from "./types";
import { parseLogs } from "./utils";

export const DECIMALS = 18;
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
   * @param inputs an array of input coins to be used for minting
   * @param minMinted the minimum amount of Gyro to be minted, to let the caller decide on maximum slippage
   * @param approveFuture whether to approve the library to transfer the minimum amount to mint
   *                      or a large amount to avoid needing to approve again for future mints
   */
  async mint(
    inputs: InputCoin[],
    minMinted: number = 0,
    approveFuture: boolean = true
  ): Promise<MintResult> {
    const approveTxs = await this.approveTokensForLib(inputs, approveFuture);
    const tokensIn = inputs.map((i) => i.token);
    const amountsIn = inputs.map((i) => this.numberFromInputAmount(i.amount));

    const tx = await this.gyroLib.mintFromUnderlyingTokens(tokensIn, amountsIn, minMinted);
    const allTxs = [tx].concat(approveTxs).map((t) => t.wait());

    return Promise.all(allTxs).then(([mintReceipt, ...approveReceipts]) => {
      return {
        amountMinted: this.extractMintedAmount(mintReceipt),
        mintReceipt,
        approveReceipts,
      };
    });
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

  private extractMintedAmount(mintReceipt: ContractReceipt): BigNumber {
    const events = parseLogs(mintReceipt, this.gyroLib.interface, this.gyroFund.interface);
    const mintEvent = events.find((evt) => evt.name === "Mint");
    return mintEvent ? mintEvent.args.amount : BigNumber.from(0);
  }

  private async approveTokensForLib(
    inputs: InputCoin[],
    approveFuture: boolean = true
  ): Promise<ContractTransaction[]> {
    const ercs = inputs.map((i) => ERC20Factory.connect(i.token, this.signer));
    const allowances = await Promise.all(
      ercs.map((erc) => erc.allowance(this._address, this.gyroLib.address))
    );

    const approvePromises = [];
    for (let i = 0; i < ercs.length; i++) {
      if (allowances[i] < inputs[i].amount) {
        const approveAmount = approveFuture
          ? BigNumber.from(10).pow(50)
          : this.numberFromInputAmount(inputs[i].amount);
        approvePromises.push(ercs[i].approve(this.gyroLib.address, approveAmount));
      }
    }
    return Promise.all(approvePromises);
  }

  private numberFromInputAmount(amount: BigNumberish | MonetaryAmount): BigNumber {
    if (amount instanceof MonetaryAmount) {
      return amount.value;
    } else {
      return BigNumber.from(amount);
    }
  }
}
