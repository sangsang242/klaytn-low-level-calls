import type { Contract } from 'ethers'
import {
  Interface,
  BigNumber,
  keccak256,
  defaultAbiCoder,
  solidityPack
} from 'ethers/utils'

function getDomainSeparator(chainId: number, contractAddress: string): string {
  return keccak256(
    defaultAbiCoder.encode(
      ['uint256', 'address'],
      [
        chainId,
        contractAddress
      ]
    )
  )
}

// return calldata for specific contract
export function getCalldata(
  contractName: string,
  functionName: string,
  argumentArr: any[]
): string {
  const compiled = require(`../../build/${contractName}.json`);
  // web3 style
  // const contract = new web3.Contract(compiled.abi);
  // return contract.methods[functionName](...argumentArr).encodeABI();
  const contract = new Interface(compiled.abi)
  return contract.functions[functionName].encode(argumentArr);
}

export function getPosition(
  calldata: string,
  tobeCalldata: string
): number {
  // index 는 tobe calldata 파라미터 몇번쨰 인지를 말하는 것이고
  // 해당 값은 바이트 이기 떄문에 그 위치로 가서 좌표를 확인해야 한다.
  return calldata.indexOf(tobeCalldata.substring(2)) / 2 - 1;
}

// hashing
export async function getDigest(
  chainId: number,
  proxy: Contract,
  expiry: BigNumber | number,
  nonce: number,
  dest: string,
  val: number,
  pos: number,
  tobeCalldata: string
): Promise<string> {
  const DOMAIN_SEPARATOR = getDomainSeparator(chainId, proxy.address)
  return keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          solidityPack(
            ['uint256', 'uint256', 'address', 'uint256', 'uint256', 'bytes'],
            [expiry, nonce, dest, val, pos, tobeCalldata]
          )
        )
      ]
    )
  )
}
