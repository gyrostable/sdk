# Gyro SDK

TypeScript/JavaScript SDK to interact with Gyro.

## Development

Follow the installation instructions of `https://github.com/stablecoin-labs/core`
including starting the node and linking the package.
Then run the following

```
yarn install
yarn link @gyrostable/core
yarn link
yarn build
```

To make sure everything is working, try running the tests using `yarn test`.

To compile automatically when changing something, run `yarn build --watch` instead of `yarn build`.

## Usage

The SDK is based around the `Gyro` class, which can be instantiated as follows:


```typescript
import { Gyro } from "@gyrostable/sdk";
import { ethers } from "ethers";

const provider = new ethers.providers.Web3Provider(window.ethereum);
const gyro = await Gyro.create(provider);

const tokens = await gyro.getSupportedTokens();

const usdt = tokens.find((t) => t.symbol === "USDT");
const weth = tokens.find((t) => t.symbol === "WETH");

const inputs = [
  { token: usdt.address, amount: MonetaryAmount.fromNormalized(2500, usdc.decimals) }
  { token: weth.address, amount: MonetaryAmount.fromNormalized(2, weth.decimals) }
];
const mintResult = await gyro.mint(inputs);
console.log(`Minted ${mintResult} tokens`);
const currentBalance = await gyro.balance();
console.log(`Gyro balance: ${currentBalance.toNormalizedString()}`);
```
