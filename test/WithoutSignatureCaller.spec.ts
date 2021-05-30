import chai, { expect } from "chai";
import { Wallet, Contract } from "ethers";
import { solidity, MockProvider, deployContract } from "ethereum-waffle";

import { getCalldata, getPosition } from "./shared/utilities";

import proxyCompiled from "../build/WithoutSignatureCaller.json";
import countersCompiled from "../build/CountersImpl.json";

chai.use(solidity);

interface DefaultParams {
  dest: string;
  val: number;
  pos: number;
  tobeCalldata: string;
}

describe("WithoutSignatureCaller", () => {
  const provider = new MockProvider({
    hardfork: "petersburg",
    mnemonic: "horn horn horn horn horn horn horn horn horn horn horn horn",
    gasLimit: 9999999,
  });
  const [owner, other]: Wallet[] = provider.getWallets();

  const defaults: DefaultParams = {
    dest: other.address,
    val: 0,
    pos: 0,
    tobeCalldata: "0x",
  };

  let proxy: Contract;
  beforeEach(async () => {
    proxy = await deployContract(owner, proxyCompiled, []);
  });

  it("[function owner] contract owner is contract creator", async () => {
    expect(await proxy.owner()).to.eq(owner.address);
  });

  it("[function owner] contract owner is contract creator:fail", async () => {
    expect(await proxy.owner()).to.not.eq(other.address);
  });

  it("[function ownerCall] can only be called by owner", async () => {
    await expect(
      proxy.ownerCall(
        defaults.dest,
        defaults.val,
        defaults.pos,
        defaults.tobeCalldata
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
  });

  it("[function ownerCall] can only be called by owner:fail", async () => {
    await expect(
      proxy
        .connect(other)
        .ownerCall(
          defaults.dest,
          defaults.val,
          defaults.pos,
          defaults.tobeCalldata
        )
    ).to.be.reverted;
  });

  it("[function ownerCall->address] sends ether to other address through proxy contract", async () => {
    const etherToSend: number = 242;

    const calldata: string = getCalldata(
      "WithoutSignatureCaller",
      "ownerCall",
      [defaults.dest, etherToSend, defaults.pos, defaults.tobeCalldata]
    );

    await expect(() =>
      owner.sendTransaction({
        to: proxy.address,
        value: etherToSend,
        data: calldata,
      })
    ).to.changeBalance(other, etherToSend);

    // different approach instead of temporary simulation transaction
    const initialBalance = await other.getBalance();
    await owner.sendTransaction({
      to: proxy.address,
      value: etherToSend,
      data: calldata,
    });
    expect(await other.getBalance()).to.eq(initialBalance.add(etherToSend));
  });

  it("[function ownerCall->increment] increases counter countract by 2", async () => {
    let counters: Contract = await deployContract(owner, countersCompiled, []);
    const newDest = counters.address;

    // alaways starts at 0
    expect(await counters.current()).to.eq(0);

    // proxy contract to call counters contract with calldata
    const newTobeCalldata: string = getCalldata(
      "CountersImpl",
      "increment",
      []
    );

    let calldata: string = getCalldata("WithoutSignatureCaller", "ownerCall", [
      newDest,
      defaults.val,
      defaults.pos, //164, // to be calculated
      newTobeCalldata,
    ]);

    calldata = getCalldata("WithoutSignatureCaller", "ownerCall", [
      newDest,
      defaults.val,
      getPosition(calldata, newTobeCalldata), // with real position of proxy's to calldata
      newTobeCalldata,
    ]);

    // increase counter's value through proxy contract by 1
    await owner.sendTransaction({
      to: proxy.address,
      value: defaults.val,
      data: calldata,
    });

    // increase counter's value directly by 1
    await owner.sendTransaction({
      to: counters.address,
      value: defaults.val,
      data: newTobeCalldata,
    });

    // total value of 2 is expected
    expect(await counters.current()).to.eq(2);
  });
});
