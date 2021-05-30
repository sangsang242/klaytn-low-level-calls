import chai, { expect } from "chai";
import { Wallet, Contract } from "ethers";
import { BigNumber } from "ethers/utils/bignumber";
import { MaxUint256 } from "ethers/constants";
import { solidity, MockProvider, deployContract } from "ethereum-waffle";
import { ecsign, toRpcSig, ECDSASignature } from "ethereumjs-util";

import { getCalldata, getDigest, getPosition } from "./shared/utilities";

import proxyCompiled from "../build/WithSignatureCaller.json";
import countersCompiled from "../build/CountersImpl.json";

chai.use(solidity);

const chainId: number = 1;
interface DefaultParams {
  expiry: BigNumber;
  nonce: number;
  dest: string;
  val: number;
  pos: number;
  tobeCalldata: string;
}

describe("WithSignatureCaller", () => {
  const provider = new MockProvider({
    hardfork: "petersburg",
    mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
    gasLimit: 9999999,
  });
  const [owner, other]: Wallet[] = provider.getWallets();

  const defaults: DefaultParams = {
    expiry: MaxUint256,
    nonce: 0,
    dest: other.address,
    val: 0,
    pos: 0,
    tobeCalldata: "0x",
  };

  let proxy: Contract;
  beforeEach(async () => {
    proxy = await deployContract(owner, proxyCompiled, [chainId]);
  });

  it("[function owner] contract owner is contract creator", async () => {
    expect(await proxy.owner()).to.eq(owner.address);
  });

  it("[function owner] contract owner is contract creator:fail", async () => {
    expect(await proxy.owner()).to.not.eq(other.address);
  });

  it("[function getSigner] owner properly signed", async () => {
    const digest: string = await getDigest(
      chainId,
      proxy,
      defaults.expiry,
      defaults.nonce,
      defaults.dest,
      defaults.val,
      defaults.pos,
      defaults.tobeCalldata
    );
    const signedByOwner: ECDSASignature = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(owner.privateKey.slice(2), "hex")
    );
    expect(
      await proxy.getSigner(
        digest,
        signedByOwner.v,
        signedByOwner.r,
        signedByOwner.s
      )
    ).to.eq(owner.address);

    const signedByOther: ECDSASignature = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(other.privateKey.slice(2), "hex")
    );
    expect(
      await proxy.getSigner(
        digest,
        signedByOther.v,
        signedByOther.r,
        signedByOther.s
      )
    ).to.eq(other.address);
  });

  it("[function authorizedCall] can only be called with owner's signature", async () => {
    // datas should be hased to be signed by proxy contract owner
    const digest: string = await getDigest(
      chainId,
      proxy,
      defaults.expiry,
      defaults.nonce,
      defaults.dest,
      defaults.val,
      defaults.pos,
      defaults.tobeCalldata
    );
    const signed: ECDSASignature = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(owner.privateKey.slice(2), "hex") // signed by owner
    );
    const signature: string = toRpcSig(signed.v, signed.r, signed.s);

    // owner sends transaction with owner's signature
    await expect(
      proxy.authorizedCall(
        defaults.expiry,
        defaults.nonce,
        defaults.dest,
        defaults.val,
        defaults.pos,
        defaults.tobeCalldata,
        signature
      )
    )
      .to.emit(proxy, "ExternalCall")
      .withArgs(
        owner.address,
        defaults.dest,
        defaults.val,
        defaults.pos,
        defaults.tobeCalldata
      );

    // other sends transaction with owner's signature
    await expect(
      proxy
        .connect(other)
        .authorizedCall(
          defaults.expiry,
          defaults.nonce,
          defaults.dest,
          defaults.val,
          defaults.pos,
          defaults.tobeCalldata,
          signature
        )
    )
      .to.emit(proxy, "ExternalCall")
      .withArgs(
        other.address,
        defaults.dest,
        defaults.val,
        defaults.pos,
        defaults.tobeCalldata
      );

    // anyone can use proxy contract if he has the owner's signature
  });

  it("[function authorizedCall] can only be called with owner's signature:fail", async () => {
    const digest: string = await getDigest(
      chainId,
      proxy,
      defaults.expiry,
      defaults.nonce,
      defaults.dest,
      defaults.val,
      defaults.pos,
      defaults.tobeCalldata
    );
    const signed: ECDSASignature = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(other.privateKey.slice(2), "hex") // signed by other
    );
    const signature: string = toRpcSig(signed.v, signed.r, signed.s);

    // owner sends transaction with other's signature
    await expect(
      proxy.authorizedCall(
        defaults.expiry,
        defaults.nonce,
        defaults.dest,
        defaults.val,
        defaults.pos,
        defaults.tobeCalldata,
        signature
      )
    ).to.be.reverted;

    // other sends transaction with other's signature
    await expect(
      proxy
        .connect(other)
        .authorizedCall(
          defaults.expiry,
          defaults.nonce,
          defaults.dest,
          defaults.val,
          defaults.pos,
          defaults.tobeCalldata,
          signature
        )
    ).to.be.reverted;
  });

  it("[function authorizedCall->address] sends ether to other address through proxy contract", async () => {
    const etherToSend: number = 242;

    const digest: string = await getDigest(
      chainId,
      proxy,
      defaults.expiry,
      defaults.nonce,
      defaults.dest,
      etherToSend,
      defaults.pos,
      defaults.tobeCalldata
    );
    const signed: ECDSASignature = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(owner.privateKey.slice(2), "hex")
    );
    const signature: string = toRpcSig(signed.v, signed.r, signed.s);

    const calldata: string = getCalldata(
      "WithSignatureCaller",
      "authorizedCall",
      [
        defaults.expiry,
        defaults.nonce,
        defaults.dest,
        etherToSend,
        defaults.pos,
        defaults.tobeCalldata,
        signature,
      ]
    );

    // owner sends ether to other through proxy contract
    // it can use of pre-deposited ether in the proxy contract
    await expect(() =>
      owner.sendTransaction({
        to: proxy.address,
        value: etherToSend,
        data: calldata,
      })
    ).to.changeBalance(other, etherToSend);

    // different approach
    const initialBalance = await other.getBalance();
    await owner.sendTransaction({
      to: proxy.address,
      value: etherToSend,
      data: calldata,
    });
    expect(await other.getBalance()).to.eq(initialBalance.add(etherToSend));
  });

  it("[function authorizedCall] transaction is not expired:fail", async () => {
    const newExpiry: number = 0;

    const digest: string = await getDigest(
      chainId,
      proxy,
      newExpiry,
      defaults.nonce,
      defaults.dest,
      defaults.val,
      defaults.pos,
      defaults.tobeCalldata
    );
    const signed: ECDSASignature = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(owner.privateKey.slice(2), "hex")
    );
    const signature: string = toRpcSig(signed.v, signed.r, signed.s);

    await expect(
      proxy
        .connect(other)
        .authorizedCall(
          newExpiry,
          defaults.nonce,
          defaults.dest,
          defaults.val,
          defaults.pos,
          defaults.tobeCalldata,
          signature
        )
    ).to.be.reverted;
  });

  it("[function authorizedCall] transaction has right nonce for one time use:fail", async () => {
    // nonce is used for signature to be used for only once in specific network
    const BigNumberNonce: BigNumber = await proxy.nonces(owner.address);
    const newNonce: number = BigNumberNonce.toNumber() + 1; // nonce for future

    const digest: string = await getDigest(
      chainId,
      proxy,
      defaults.expiry,
      newNonce,
      defaults.dest,
      defaults.val,
      defaults.pos,
      defaults.tobeCalldata
    );
    const signed: ECDSASignature = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(owner.privateKey.slice(2), "hex")
    );
    const signature: string = toRpcSig(signed.v, signed.r, signed.s);

    await expect(
      proxy
        .connect(other)
        .authorizedCall(
          defaults.expiry,
          newNonce,
          defaults.dest,
          defaults.val,
          defaults.pos,
          defaults.tobeCalldata,
          signature
        )
    ).to.be.reverted;
  });

  it("[function authorizedCall->increment] increases counter countract by 2", async () => {
    let counters: Contract = await deployContract(owner, countersCompiled, []);
    const newDest = counters.address;

    expect(await counters.current()).to.eq(0);

    const newTobeCalldata: string = getCalldata(
      "CountersImpl",
      "increment",
      []
    );

    let digest: string = await getDigest(
      chainId,
      proxy,
      defaults.expiry,
      defaults.nonce,
      newDest,
      defaults.val,
      defaults.pos,
      newTobeCalldata
    );
    let signed: ECDSASignature = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(owner.privateKey.slice(2), "hex")
    );
    let signature: string = toRpcSig(signed.v, signed.r, signed.s);

    let calldata: string = getCalldata(
      "WithSignatureCaller",
      "authorizedCall",
      [
        defaults.expiry,
        defaults.nonce,
        newDest,
        defaults.val,
        defaults.pos,
        newTobeCalldata,
        signature,
      ]
    );

    const newPos: number = getPosition(calldata, newTobeCalldata);

    digest = await getDigest(
      chainId,
      proxy,
      defaults.expiry,
      defaults.nonce,
      newDest,
      defaults.val,
      newPos,
      newTobeCalldata
    );
    signed = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(owner.privateKey.slice(2), "hex")
    );
    signature = toRpcSig(signed.v, signed.r, signed.s);
    calldata = getCalldata("WithSignatureCaller", "authorizedCall", [
      defaults.expiry,
      defaults.nonce,
      newDest,
      defaults.val,
      newPos,
      newTobeCalldata,
      signature,
    ]);

    await owner.sendTransaction({
      to: proxy.address,
      value: defaults.val,
      data: calldata,
    });
    await owner.sendTransaction({
      to: counters.address,
      value: defaults.val,
      data: newTobeCalldata,
    });
    expect(await counters.current()).to.eq(2);
  });
});
