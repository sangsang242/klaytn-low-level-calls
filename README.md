## A library for low-level-calls development in Klaytn.
 * To support Klaytn compiler version 0.5.6
 * To utilize low-level-calls for dynamic message call via proxy pattern
 * Referred to openzeppelin address library v3+


[Contracts]
====
## Libraries
* MsgCallable - Helps to perform a solidity assembly function using a low level `call`
* Verifiable - Collection of functions related to ECDSA signature recovery

## Examples
* WithoutSignatureCaller - This contract acts as proxy for contract creator
* WithSignatureCaller - This contract allows anonymous to use the balance of this contract

## Install Dependencies

`npm i`

## Compile Contracts

`npm run compile`

## Run Tests

`npm run test`

### Usage

Once installed, you can use the contracts in the library by importing them:

```solidity
pragma solidity ^0.5.0;

import "../contracts/MsgCallable.sol";
import "../contracts/Verifiable.sol";

contract Example {
    function test(
        address dest,
        uint256 val,
        uint256 pos,
        bytes calldata tobeCalldata
    ) internal returns (bool) {
        MsgCallable.externalCall(dest, val, pos, tobeCalldata.length);
    }
}
```