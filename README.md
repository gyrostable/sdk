# Gyro SDK

TypeScript/JavaScript SDK to interact with Gyro.

## Development

Follow the installation instructions of `https://github.com/stablecoin-labs/core`
including starting the node and linking the package.
Then run the following

```
yarn
yarn link
yarn build
```

To make sure everything is working, try running the tests using `yarn test`.
To compile automatically when changing something, run `yarn build --watch` instead of `yarn build`.

## Usage

The SDK is based around the `Gyro` class, which can be instantiated as follows:


```typescript
import { Gyro, contracts } from "@gyrostable/sdk";
import { ethers } from "ethers";

const provider = new ethers.providers.Web3Provider(window.ethereum);
const gyro = await Gyro.create(provider);

const currentBalance = await gyro.balance();

const inputs = [
  { token: contracts.DAIERC20.address, amount: BigNumber.from(10).pow(18).mul(2500) },
  { token: contracts.WETHERC20.address, amount: BigNumber.from(10).pow(18).mul(2) },
];
const mintResult = await gyro.mint(inputs);
console.log(`Minted ${mintResult} tokens`)
```
