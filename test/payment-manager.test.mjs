import assert from "node:assert/strict";
import test from "node:test";
import ganache from "ganache";
import { ethers } from "ethers";
import { compile } from "../scripts/compile.mjs";

const GroupStatus = Object.freeze({
  Created: 1n,
  Completed: 2n,
  Cancelled: 3n
});

async function deploy(artifact, signer, args = []) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function setup() {
  const artifacts = compile();
  const ganacheProvider = ganache.provider({
    logging: { quiet: true },
    wallet: { totalAccounts: 5 }
  });
  const provider = new ethers.BrowserProvider(ganacheProvider);

  const creator = await provider.getSigner(0);
  const payer = await provider.getSigner(1);
  const receiver = await provider.getSigner(2);
  const stranger = await provider.getSigner(3);

  const usdc = await deploy(artifacts["contracts/mocks/MockUSDC.sol:MockUSDC"], creator);
  const manager = await deploy(
    artifacts["contracts/PaymentManager.sol:PaymentManager"],
    creator,
    [await usdc.getAddress()]
  );

  return { provider, ganacheProvider, creator, payer, receiver, stranger, usdc, manager };
}

test("creates a group and sends USDC directly to the receiver", async () => {
  const { creator, payer, receiver, usdc, manager } = await setup();
  const salt = ethers.id("merchant-1:group-1001");
  const groupId = await manager.computeGroupId(await creator.getAddress(), salt);
  const totalAmount = ethers.parseUnits("12", 6);
  const maxPayers = 3;
  const perPaymentAmount = ethers.parseUnits("4", 6);
  const payerAddress = await payer.getAddress();
  const receiverAddress = await receiver.getAddress();
  const managerAddress = await manager.getAddress();

  await (await manager.connect(creator).createGroup(
    salt,
    receiverAddress,
    totalAmount,
    maxPayers
  )).wait();

  let group = await manager.getGroup(groupId);
  assert.equal(group.creator, await creator.getAddress());
  assert.equal(group.receiver, receiverAddress);
  assert.equal(group.totalAmount, totalAmount);
  assert.equal(group.perPaymentAmount, perPaymentAmount);
  assert.equal(group.maxPayers, BigInt(maxPayers));
  assert.equal(group.paidCount, 0n);
  assert.equal(group.status, GroupStatus.Created);

  await (await usdc.mint(payerAddress, perPaymentAmount)).wait();
  await (await usdc.connect(payer).approve(managerAddress, perPaymentAmount)).wait();
  await (await manager.connect(payer).payGroup(groupId)).wait();

  group = await manager.getGroup(groupId);
  const payment = await manager.getGroupPayment(groupId, payerAddress);
  const payers = await manager.getGroupPayers(groupId);

  assert.equal(group.paidAmount, perPaymentAmount);
  assert.equal(group.paidCount, 1n);
  assert.equal(group.status, GroupStatus.Created);
  assert.equal(payment.paid, true);
  assert.equal(payment.amount, perPaymentAmount);
  assert.equal(payers.length, 1);
  assert.equal(payers[0], payerAddress);
  assert.equal(await usdc.balanceOf(receiverAddress), perPaymentAmount);
  assert.equal(await usdc.balanceOf(managerAddress), 0n);
});

test("completes the group after maxPayers pay", async () => {
  const { creator, payer, receiver, stranger, usdc, manager } = await setup();
  const salt = ethers.id("merchant-1:group-complete");
  const groupId = await manager.computeGroupId(await creator.getAddress(), salt);
  const totalAmount = ethers.parseUnits("10", 6);
  const perPaymentAmount = ethers.parseUnits("5", 6);
  const receiverAddress = await receiver.getAddress();

  await (await manager.connect(creator).createGroup(
    salt,
    receiverAddress,
    totalAmount,
    2
  )).wait();

  for (const signer of [payer, stranger]) {
    await (await usdc.mint(await signer.getAddress(), perPaymentAmount)).wait();
    await (await usdc.connect(signer).approve(await manager.getAddress(), perPaymentAmount)).wait();
    await (await manager.connect(signer).payGroup(groupId)).wait();
  }

  const group = await manager.getGroup(groupId);
  const payers = await manager.getGroupPayers(groupId);

  assert.equal(group.status, GroupStatus.Completed);
  assert.equal(group.paidCount, 2n);
  assert.equal(group.paidAmount, totalAmount);
  assert.equal(payers.length, 2);

  await assert.rejects(async () => {
    await (await manager.connect(creator).cancelGroup(groupId)).wait();
  });
});

test("rejects invalid group settings and duplicate groups", async () => {
  const { creator, receiver, manager } = await setup();
  const salt = ethers.id("merchant-1:group-invalid");
  const receiverAddress = await receiver.getAddress();

  await assert.rejects(async () => {
    await (await manager.connect(creator).createGroup(
      salt,
      receiverAddress,
      ethers.parseUnits("10", 6),
      101
    )).wait();
  });

  await assert.rejects(async () => {
    await (await manager.connect(creator).createGroup(
      salt,
      receiverAddress,
      ethers.parseUnits("10", 6),
      3
    )).wait();
  });

  await (await manager.connect(creator).createGroup(
    salt,
    receiverAddress,
    ethers.parseUnits("10", 6),
    2
  )).wait();

  await assert.rejects(async () => {
    await (await manager.connect(creator).createGroup(
      salt,
      receiverAddress,
      ethers.parseUnits("10", 6),
      2
    )).wait();
  });
});

test("allows each address to pay only once", async () => {
  const { creator, payer, receiver, usdc, manager } = await setup();
  const salt = ethers.id("merchant-1:group-once");
  const groupId = await manager.computeGroupId(await creator.getAddress(), salt);
  const totalAmount = ethers.parseUnits("10", 6);
  const perPaymentAmount = ethers.parseUnits("5", 6);

  await (await manager.connect(creator).createGroup(
    salt,
    await receiver.getAddress(),
    totalAmount,
    2
  )).wait();

  await (await usdc.mint(await payer.getAddress(), totalAmount)).wait();
  await (await usdc.connect(payer).approve(await manager.getAddress(), totalAmount)).wait();
  await (await manager.connect(payer).payGroup(groupId)).wait();

  await assert.rejects(async () => {
    await (await manager.connect(payer).payGroup(groupId)).wait();
  });
});

test("allows only creator or receiver to cancel an active group", async () => {
  const { creator, receiver, stranger, manager } = await setup();
  const salt = ethers.id("merchant-1:group-cancel");
  const groupId = await manager.computeGroupId(await creator.getAddress(), salt);

  await (await manager.connect(creator).createGroup(
    salt,
    await receiver.getAddress(),
    ethers.parseUnits("10", 6),
    2
  )).wait();

  await assert.rejects(async () => {
    await (await manager.connect(stranger).cancelGroup(groupId)).wait();
  });

  await (await manager.connect(receiver).cancelGroup(groupId)).wait();

  const group = await manager.getGroup(groupId);
  assert.equal(group.status, GroupStatus.Cancelled);

  await assert.rejects(async () => {
    await (await manager.connect(stranger).payGroup(groupId)).wait();
  });
});
