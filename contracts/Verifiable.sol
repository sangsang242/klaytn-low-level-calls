pragma solidity ^0.5.0;

/// @dev Collection of functions related to ECDSA signature recovery
library Verifiable {
    /// @dev Returns the address of signature signer's
    /// @param digest hashed message to sign
    /// @param v recovery identifier
    /// @param r outputs of an ECDSA signature
    /// @param s outputs of an ECDSA signature
    /// @return address of signature signer
    function getSigner(
        bytes32 digest,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal pure returns (address) {
        address signer = ecrecover(digest, v, r, s);
        return signer;
    }

    /// @dev Checks if the signature is signed by a specific address
    /// @param expected assumed address of signer
    /// @param domainSeparator buffer for replay attack
    /// @param elements hashed data to sign
    /// @param v recovery identifier
    /// @param r outputs of an ECDSA signature
    /// @param s outputs of an ECDSA signature
    /// @return the verified result in boolean
    function verify(
        address expected,
        bytes32 domainSeparator,
        bytes32 elements,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal pure returns (bool) {
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", domainSeparator, elements));

        address signer = ecrecover(digest, v, r, s);
        return signer == expected;
    }

    /// @dev Converts signature format of the `eth_sign` RPC method to signature parameters then verifies
    /// @param expected assumed address of signer
    /// @param domainSeparator buffer for replay attack
    /// @param signature format of `eth_sign` RPC method
    /// @return the verified result in boolean
    function verify(
        address expected,
        bytes32 domainSeparator,
        bytes32 elements,
        bytes memory signature
    ) internal pure returns (bool) {
        // @openzeppelin>ECDSA.sol
        // Check the signature length
        if (signature.length != 65) {
            return false;
        }

        // Divide the signature in r, s and v variables
        uint8 v;
        bytes32 r;
        bytes32 s;

        // ecrecover takes the signature parameters, and the only way to get them
        // currently is to use assembly.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        return verify(expected, domainSeparator, elements, v, r, s);
    }
}
