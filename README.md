# Arc USDC AA Payment

A minimal non-custodial USDC group payment app for Arc Testnet.

The app lets a receiver create one payment link for a group payment. Each payer opens the same link, connects a wallet, and pays their equal share in USDC. Funds are transferred directly to the receiver address; the contract only stores payment state.

## Highlights

- One payment link per payment group
- USDC payments on Arc Testnet
- Receiver can be an EOA or an AA smart account address
- No backend database required
- Chain state is loaded through RPC
- Each payer address can pay only once
- Funds go directly to the receiver
- Multilingual frontend: English, Traditional Chinese, Japanese, Korean
- Path-based payment links, for example:

```text
http://localhost:5173/0x064e33e1086d628faeb8b3d7179c245cd8de05e29c7c53674e5ec6abe4aaf0f7
```

## How It Works

```text
Receiver connects wallet
        |
        v
Creates a payment group in PaymentManager
        |
        v
Frontend generates a /0x... payment link
        |
        v
Payers open the link and call payGroup(groupId)
        |
        v
USDC is transferred directly to the receiver
```

`PaymentManager` is a non-custodial payment coordination contract. It records the group configuration, payment status, payer list, and paid amounts, but it does not hold user funds.

## Contract Rules

The smart contract enforces:

- Maximum 100 payers per group
- Total amount must divide evenly by the number of payers
- One payment per payer address
- Group status transitions: `Created`, `Completed`, `Cancelled`
- Only the creator or receiver can cancel an active group
- USDC is transferred with `transferFrom(payer, receiver, amount)`

Main contract: [`contracts/PaymentManager.sol`](contracts/PaymentManager.sol)

## AA Wallet Notes

The receiver address can be an EOA or an AA smart account address. ERC-20 balances are tracked by the USDC contract, so an AA wallet does not need to actively "receive" funds.

For AA payers, `USDC.approve()` and `PaymentManager.payGroup()` can be bundled into one UserOperation if the wallet infrastructure supports it. The included browser UI currently uses the standard wallet flow.

## Deployed Arc Testnet Configuration

```text
Chain: Arc Testnet
Chain ID: 5042002
RPC: https://rpc.testnet.arc.network
USDC: 0x3600000000000000000000000000000000000000
PaymentManager: 0xF8Cefd1d7a6C52eE621e939CFA49f929983f5E3B
Explorer: https://testnet.arcscan.app
```

The frontend uses the PaymentManager address configured in `src/web-app.mjs`.

## Project Structure

```text
contracts/                 Solidity payment manager contract
scripts/                   Compile and deployment scripts
src/payment-manager-client.mjs
                           Shared ethers client helpers
src/web-app.mjs            Browser app logic
src/styles.css             Frontend styles
test/                      Contract tests
index.html                 Vite entry point
```

## Getting Started

Install dependencies:

```bash
npm install
```

Compile contracts:

```bash
npm run compile
```

Run tests:

```bash
npm test
```

Start the local web app:

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

## Deploying to Arc Testnet

Create an environment file:

```bash
cp .env.example .env
```

Configure:

```text
ARC_RPC_URL=https://rpc.testnet.arc.network
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
USDC_ADDRESS=0x3600000000000000000000000000000000000000
PAYMENT_MANAGER_ADDRESS=0xDEPLOYED_PAYMENT_MANAGER
```

Deploy:

```bash
npm run deploy:arc
```

After deployment, update the frontend PaymentManager address in `src/web-app.mjs` if needed.

## Payment Link Format

The current payment URL format is path-based:

```text
/{groupId}
```

Example:

```text
http://localhost:5173/0x064e33e1086d628faeb8b3d7179c245cd8de05e29c7c53674e5ec6abe4aaf0f7
```

The app reads the `groupId` from the path, queries the contract through RPC, and renders the payment status.

## Frontend Behavior

On the create page:

1. Connect a wallet.
2. Enter the receiver address, payer count, and total USDC amount.
3. The app calculates the per-payer amount.
4. Create the group on-chain.
5. After confirmation, copy the generated payment link.

On the payment page:

1. The app loads the group from the URL path.
2. It reads group status, paid count, paid amount, and payer history from RPC.
3. The payer connects a wallet.
4. The app checks USDC balance and payment status.
5. If needed, the payer approves USDC.
6. The payer calls `payGroup(groupId)`.

## Client Helpers

Read payment group state:

```js
import {
  getProvider,
  readGroupDetails
} from "./src/payment-manager-client.mjs";

const provider = getProvider("https://rpc.testnet.arc.network");
const { group, payers, payments } = await readGroupDetails(
  provider,
  paymentManagerAddress,
  groupId
);
```

Pay a group from an EOA wallet:

```js
import { payGroupWithApproval } from "./src/payment-manager-client.mjs";

await payGroupWithApproval({
  signer,
  paymentManagerAddress,
  groupId
});
```

## Security Notes

This is a demo implementation. It has not been audited.

Review the contract, deployment configuration, token address, and wallet flow before using it with real funds.

## License

MIT
