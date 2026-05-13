import { ethers } from "ethers";

export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
export const MAX_PAYERS = 100;

export const GroupStatus = Object.freeze({
  Unknown: 0n,
  Created: 1n,
  Completed: 2n,
  Cancelled: 3n
});

export const PaymentManagerAbi = [
  "function MAX_PAYERS() view returns (uint32)",
  "function computeGroupId(address creator,bytes32 salt) view returns (bytes32)",
  "function createGroup(bytes32 salt,address receiver,uint256 totalAmount,uint32 maxPayers) returns (bytes32)",
  "function payGroup(bytes32 groupId)",
  "function cancelGroup(bytes32 groupId)",
  "function getGroup(bytes32 groupId) view returns ((address creator,address receiver,uint256 totalAmount,uint256 perPaymentAmount,uint256 paidAmount,uint32 maxPayers,uint32 paidCount,uint8 status))",
  "function getGroupPayment(bytes32 groupId,address payer) view returns ((uint256 amount,uint64 paidAt,bool paid))",
  "function getGroupPayers(bytes32 groupId) view returns (address[])",
  "event GroupCreated(bytes32 indexed groupId,address indexed creator,address indexed receiver,uint256 totalAmount,uint256 perPaymentAmount,uint32 maxPayers)",
  "event GroupPaid(bytes32 indexed groupId,address indexed payer,address indexed receiver,uint256 amount,uint64 paidAt,uint32 paidCount)",
  "event GroupCancelled(bytes32 indexed groupId,address indexed canceller)"
];

export const Erc20Abi = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

let lastTimeMicros = 0n;

export function getProvider(rpcUrl) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function currentTimeMicros() {
  const preciseNow = globalThis.performance?.now?.() ?? 0;
  let timeMicros = (BigInt(Date.now()) * 1000n)
    + BigInt(Math.floor((preciseNow % 1) * 1000));

  if (timeMicros <= lastTimeMicros) {
    timeMicros = lastTimeMicros + 1n;
  }

  lastTimeMicros = timeMicros;
  return timeMicros;
}

export function generateGroupSalt(receiver, totalAmount, maxPayers, timeMicros = currentTimeMicros()) {
  const receiverAddress = ethers.getAddress(receiver);
  const totalAmountValue = BigInt(totalAmount);
  const maxPayersValue = Number(maxPayers);
  const source = `${receiverAddress}:${timeMicros.toString()}:${totalAmountValue.toString()}:${maxPayersValue}`;

  return {
    source,
    salt: ethers.keccak256(ethers.toUtf8Bytes(source)),
    timeMicros
  };
}

export function toUsdcUnits(amount) {
  return ethers.parseUnits(String(amount), 6);
}

export function getPaymentManager(runner, paymentManagerAddress) {
  return new ethers.Contract(paymentManagerAddress, PaymentManagerAbi, runner);
}

export async function computeGroupId(runner, paymentManagerAddress, creator, salt) {
  const manager = getPaymentManager(runner, paymentManagerAddress);
  return manager.computeGroupId(creator, salt);
}

export async function readGroup(runner, paymentManagerAddress, groupId) {
  const manager = getPaymentManager(runner, paymentManagerAddress);
  return manager.getGroup(groupId);
}

export async function readGroupPayers(runner, paymentManagerAddress, groupId) {
  const manager = getPaymentManager(runner, paymentManagerAddress);
  return manager.getGroupPayers(groupId);
}

export async function readGroupPayment(runner, paymentManagerAddress, groupId, payer) {
  const manager = getPaymentManager(runner, paymentManagerAddress);
  return manager.getGroupPayment(groupId, payer);
}

export async function readGroupDetails(runner, paymentManagerAddress, groupId) {
  const manager = getPaymentManager(runner, paymentManagerAddress);
  const [group, payers] = await Promise.all([
    manager.getGroup(groupId),
    manager.getGroupPayers(groupId)
  ]);
  const payments = await Promise.all(
    payers.map((payer) => manager.getGroupPayment(groupId, payer))
  );

  return { group, payers, payments };
}

export async function createGroup({
  signer,
  paymentManagerAddress,
  salt,
  receiver,
  totalAmount,
  maxPayers
}) {
  const manager = getPaymentManager(signer, paymentManagerAddress);
  const tx = await manager.createGroup(salt, receiver, totalAmount, maxPayers);
  return tx.wait();
}

async function waitForTransactionReceipt(signer, hash, confirmations, timeoutMs) {
  const receipt = await signer.provider.waitForTransaction(hash, confirmations, timeoutMs);
  if (!receipt) {
    throw new Error(`交易已发送但暂未确认，请在区块浏览器查询：${hash}`);
  }
  if (receipt.status === 0) {
    throw new Error(`交易执行失败：${hash}`);
  }
  return receipt;
}

export async function payGroupWithApproval({
  signer,
  paymentManagerAddress,
  groupId,
  usdcAddress = ARC_USDC_ADDRESS,
  confirmations = 1,
  timeoutMs = 120000,
  onApproveTx,
  onPayTx
}) {
  const payer = await signer.getAddress();
  const manager = getPaymentManager(signer, paymentManagerAddress);
  const group = await manager.getGroup(groupId);
  const payment = await manager.getGroupPayment(groupId, payer);

  if (group.status !== GroupStatus.Created) {
    throw new Error(`Group is not payable. Current status: ${group.status}`);
  }
  if (payment.paid) {
    throw new Error("This address has already paid this group");
  }

  const usdc = new ethers.Contract(usdcAddress, Erc20Abi, signer);
  const allowance = await usdc.allowance(payer, paymentManagerAddress);

  if (allowance < group.perPaymentAmount) {
    const approveTx = await usdc.approve(paymentManagerAddress, group.perPaymentAmount);
    onApproveTx?.(approveTx.hash);
    await waitForTransactionReceipt(signer, approveTx.hash, confirmations, timeoutMs);
  }

  const payTx = await manager.payGroup(groupId);
  onPayTx?.(payTx.hash);
  return waitForTransactionReceipt(signer, payTx.hash, confirmations, timeoutMs);
}
