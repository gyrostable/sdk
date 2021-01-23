# Gyro SDK

TypeScript/JavaScript SDK to interact with Gyro.

## Installation

Add the `@gyrostable/sdk` package to your package.json

```
yarn add @gyrostable/sdk
```

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
