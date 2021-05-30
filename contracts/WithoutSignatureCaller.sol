pragma solidity ^0.5.0;

import "../node_modules/@openzeppelin/contracts/ownership/Ownable.sol";
import "./MsgCallable.sol";

/// @title WithoutSignatureCaller
/// @dev This contract acts as proxy for contract creator
contract WithoutSignatureCaller is Ownable {
    event ExternalCall(
        address caller,
        address dest,
        uint256 value,
        uint256 pos,
        uint256 size
    );

    function ownerCall(
        address dest,
        uint256 val,
        uint256 pos,
        bytes calldata tobeCalldata
    ) external payable onlyOwner {
        require(
            MsgCallable.externalCall(dest, val, pos, tobeCalldata.length),
            "externalCall fail"
        );
        emit ExternalCall(msg.sender, dest, val, pos, tobeCalldata.length);
    }
}
