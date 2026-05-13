import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { compile } from "./compile.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultUsdcAddress = "0x3600000000000000000000000000000000000000";

function loadEnv() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ??= value;
  }
}

loadEnv();

const rpcUrl = process.env.ARC_RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const usdcAddress = process.env.USDC_ADDRESS ?? defaultUsdcAddress;

if (!rpcUrl) {
  throw new Error("Missing ARC_RPC_URL. Copy .env.example to .env and set the RPC URL.");
}

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY. Copy .env.example to .env and set a deployer key.");
}

const artifacts = compile();
const paymentManagerArtifact = artifacts["contracts/PaymentManager.sol:PaymentManager"];

const provider = new ethers.JsonRpcProvider(rpcUrl);
const deployer = new ethers.Wallet(privateKey, provider);
const factory = new ethers.ContractFactory(
  paymentManagerArtifact.abi,
  paymentManagerArtifact.bytecode,
  deployer
);

console.log(`Deploying PaymentManager`);
console.log(`Deployer: ${deployer.address}`);
console.log(`USDC: ${usdcAddress}`);

const deployTx = await factory.getDeployTransaction(usdcAddress);
deployTx.gasLimit = BigInt(process.env.DEPLOY_GAS_LIMIT ?? "3000000");

const feeData = await provider.getFeeData();
if (feeData.gasPrice) {
  deployTx.gasPrice = feeData.gasPrice;
}

const tx = await deployer.sendTransaction(deployTx);
const contractAddress = ethers.getCreateAddress({
  from: deployer.address,
  nonce: tx.nonce
});

console.log(`Deploy tx: ${tx.hash}`);
console.log(`Expected PaymentManager: ${contractAddress}`);

const receipt = await provider.waitForTransaction(tx.hash, 1, 180000);
if (!receipt) {
  throw new Error(`Deployment transaction was sent but not confirmed within 180s: ${tx.hash}`);
}
if (receipt.status === 0) {
  throw new Error(`Deployment transaction failed: ${tx.hash}`);
}

console.log(`PaymentManager: ${contractAddress}`);
