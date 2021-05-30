pragma solidity ^0.5.0;

/// @dev Helps to perform a solidity assembly function using a low level `call`
library MsgCallable {
    /// @dev Makes internal transaction to EOA or contract of given address
    /// @param dest address to call
    /// @param val ether amount
    /// @param pos starting position of calldata to send in the initial calldata
    /// @param size size of calldata
    /// @return result status of CALL in boolean
    function externalCall(
        address dest,
        uint256 val,
        uint256 pos,
        uint256 size
    ) internal returns (bool result) {
        require(address(this).balance >= val, "not enough balance");
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, pos, size)
            result := call(gas, dest, val, ptr, size, 0, 0)
        }
    }
}
