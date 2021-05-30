pragma solidity ^0.5.0;

import "../node_modules/@openzeppelin/contracts/ownership/Ownable.sol";
import "./MsgCallable.sol";
import "./Verifiable.sol";

/// @title WithSignatureCaller
/// @dev This contract allows anonymous to use the balance of this contract
contract WithSignatureCaller is Ownable {
    // buffer for replay attack
    bytes32 public DOMAIN_SEPARATOR;

    // signature can be used for once
    mapping(address => uint256) public nonces;

    event ExternalCall(
        address caller,
        address dest,
        uint256 value,
        uint256 pos,
        uint256 size
    );

    constructor(uint256 chainId) public {
        // chainid(): higher compiler version(0.5.12) required
        DOMAIN_SEPARATOR = keccak256(abi.encode(chainId, address(this)));
    }

    function getSigner(
        bytes32 digest,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public pure returns (address) {
        return Verifiable.getSigner(digest, v, r, s);
    }

    function authorizedCall(
        uint256 expiry,
        uint256 nonce,
        address dest,
        uint256 val,
        uint256 pos,
        bytes calldata tobeCalldata,
        bytes calldata signature
    ) external payable {
        require(block.number <= expiry, "block number expired");
        require(nonces[msg.sender] == nonce, "wrong nonce");

        bytes32 elements =
            keccak256(
                abi.encodePacked(expiry, nonce, dest, val, pos, tobeCalldata)
            );
        require(
            Verifiable.verify(owner(), DOMAIN_SEPARATOR, elements, signature),
            "verify fail"
        );

        require(
            MsgCallable.externalCall(dest, val, pos, tobeCalldata.length),
            "externalCall fail"
        );
        emit ExternalCall(msg.sender, dest, val, pos, tobeCalldata.length);
    }
}
