import { ContractReceipt, ethers } from "ethers";
import { LogDescription } from "ethers/lib/utils";

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * This function will try to parse logs from `receipt` trying all the
 * interfaces given in `contractInterfaces` and return an array of all successfully
 * parsed logs
 *
 * @param receipt contract receipt from which to parse logs
 * @param contractInterfaces interfaces with which to try to parse logs
 * @returns succesfully parsed logs
 */
export function parseLogs(
  receipt: ContractReceipt,
  ...contractInterfaces: ethers.utils.Interface[]
): LogDescription[] {
  return receipt.logs
    .map((v) => {
      for (const contractInterface of contractInterfaces) {
        try {
          return contractInterface.parseLog(v);
        } catch (e) {
          continue;
        }
      }
      return null;
    })
    .filter(notEmpty);
}
