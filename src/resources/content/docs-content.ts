/**
 * Embedded documentation content for offline access
 * Separated from docs.ts for better maintainability
 */

export const EMBEDDED_DOCS: Record<string, string> = {
  "midnight://docs/compact-reference": `# Compact Language Reference

Compact is a TypeScript-inspired language for writing privacy-preserving smart contracts on Midnight.

## Basic Structure

\`\`\`compact
include "std";

ledger {
  // Public state (on-chain, visible to everyone)
  counter: Counter;
  
  // Private state (off-chain, only owner can see)
  @private
  secretValue: Field;
}

// Circuit - generates ZK proof
export circuit increment(amount: Field): Void {
  assert(amount > 0);
  ledger.counter.increment(amount);
}

// Witness - off-chain computation
witness getSecret(): Field {
  return ledger.secretValue;
}
\`\`\`

## Data Types

### Primitive Types
- \`Field\` - Finite field element (basic numeric type)
- \`Boolean\` - True or false
- \`Bytes<N>\` - Fixed-size byte array
- \`Uint<N>\` - Unsigned integer (N = 8, 16, 32, 64, 128, 256)

### Collection Types
- \`Counter\` - Incrementable/decrementable counter
- \`Map<K, V>\` - Key-value mapping
- \`Set<T>\` - Collection of unique values
- \`Opaque<T>\` - Type-safe wrapper for arbitrary data

## Circuits

Circuits are functions that generate zero-knowledge proofs:

\`\`\`compact
export circuit transfer(to: Address, amount: Field): Void {
  // Assertions create ZK constraints
  assert(amount > 0);
  assert(ledger.balance.value() >= amount);
  
  // State modifications
  ledger.balance.decrement(amount);
}
\`\`\`

### Key Points:
- \`export\` makes circuit callable from outside
- Must be deterministic (same inputs = same outputs)
- Cannot access external data directly (use witnesses)
- Assertions become ZK constraints

## Witnesses

Witnesses provide off-chain data to circuits:

\`\`\`compact
witness getCurrentPrice(): Field {
  // This runs off-chain
  return fetchPrice();
}

export circuit swap(amount: Field): Void {
  const price = getCurrentPrice();
  // Use price in circuit logic
}
\`\`\`

## Built-in Functions

### Cryptographic
- \`hash(data)\` - Compute cryptographic hash
- \`commit(value)\` - Create hiding commitment
- \`disclose(private)\` - Reveal private data

### State Operations
- \`Counter.increment(n)\` - Add to counter
- \`Counter.decrement(n)\` - Subtract from counter
- \`Counter.value()\` - Read current value
- \`Map.insert(k, v)\` - Add key-value
- \`Map.get(k)\` - Retrieve value
- \`Set.add(v)\` - Add to set
- \`Set.contains(v)\` - Check membership

## Privacy Annotations

\`\`\`compact
ledger {
  publicData: Field;      // Visible on-chain
  @private
  privateData: Field;     // Only owner sees
}
\`\`\`
`,

  "midnight://docs/sdk-api": `# Midnight TypeScript SDK API

## Installation

\`\`\`bash
npm install @midnight-ntwrk/midnight-js-contracts @midnight-ntwrk/midnight-js-types
\`\`\`

## Core Packages

### @midnight-ntwrk/midnight-js-contracts
Contract interaction layer for deploying and calling Midnight smart contracts.

\`\`\`typescript
import { Contract, DeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

// Deploy a contract
const deployed = await Contract.deploy(
  wallet,
  contractArtifact,
  initialState
);

// Call a circuit
const result = await deployed.call('increment', { amount: 1n });
\`\`\`

### @midnight-ntwrk/midnight-js-types
Shared types and interfaces for the SDK.

\`\`\`typescript
import type { 
  Address,
  Transaction,
  Proof,
  ContractState 
} from '@midnight-ntwrk/midnight-js-types';
\`\`\`

### @midnight-ntwrk/wallet-api
Wallet integration interface.

\`\`\`typescript
import { WalletAPI } from '@midnight-ntwrk/wallet-api';

const wallet = await WalletAPI.connect();
const address = await wallet.getAddress();
const balance = await wallet.getBalance();
\`\`\`

## Common Patterns

### Contract Deployment
\`\`\`typescript
import { Contract } from '@midnight-ntwrk/midnight-js-contracts';
import counterContract from './counter.json';

async function deployCounter() {
  const deployed = await Contract.deploy(
    wallet,
    counterContract,
    { counter: 0n }
  );
  
  console.log('Deployed at:', deployed.address);
  return deployed;
}
\`\`\`

### Calling Circuits
\`\`\`typescript
async function increment(contract: DeployedContract, amount: bigint) {
  const tx = await contract.call('increment', { amount });
  await tx.wait();
  
  const newValue = await contract.query('counter');
  return newValue;
}
\`\`\`

### Querying State
\`\`\`typescript
async function getState(contract: DeployedContract) {
  const publicState = await contract.query('publicField');
  // Note: Private state requires witness functions
  return publicState;
}
\`\`\`
`,

  "midnight://docs/concepts/zero-knowledge": `# Zero-Knowledge Proofs in Midnight

## What are Zero-Knowledge Proofs?

Zero-knowledge proofs (ZKPs) allow one party (the prover) to convince another party (the verifier) that a statement is true, without revealing any information beyond the validity of the statement.

## How Midnight Uses ZKPs

In Midnight, every circuit execution generates a zero-knowledge proof:

1. **User calls a circuit** with private inputs
2. **Proof is generated** off-chain
3. **Only the proof** (not the inputs) is submitted to the blockchain
4. **Validators verify** the proof without knowing the inputs

## Example

\`\`\`compact
export circuit proveAge(birthYear: Field): Boolean {
  const currentYear = 2024;
  const age = currentYear - birthYear;
  
  // Proves user is over 18 without revealing exact age
  assert(age >= 18);
  return true;
}
\`\`\`

When this circuit runs:
- Input: \`birthYear = 1990\` (private)
- Output: \`true\` (public)
- Proof: "I know a birthYear that makes age >= 18" (public)

The verifier learns the user is over 18, but not their actual birth year.

## Key Properties

1. **Completeness**: Valid proofs always verify
2. **Soundness**: Invalid proofs cannot be forged
3. **Zero-knowledge**: Nothing beyond validity is revealed

## Privacy Patterns

### Selective Disclosure
\`\`\`compact
export circuit verifyCredential(
  @private credential: Credential
): Field {
  // Prove credential is valid
  assert(credential.isValid());
  
  // Only reveal specific fields
  return disclose(credential.issuer);
}
\`\`\`

### Hidden Computation
\`\`\`compact
export circuit secretBid(
  @private amount: Field,
  commitment: Field
): Void {
  // Prove bid matches commitment without revealing amount
  assert(commit(amount) == commitment);
}
\`\`\`
`,

  "midnight://docs/concepts/shielded-state": `# Shielded vs Unshielded State

Midnight supports two types of state: shielded (private) and unshielded (public).

## Unshielded State

Public state visible to everyone on the blockchain:

\`\`\`compact
ledger {
  totalSupply: Counter;          // Public counter
  balances: Map<Address, Field>; // Public mapping
}
\`\`\`

**Use for:**
- Token total supply
- Public voting tallies
- Any data that should be transparent

## Shielded State

Private state only visible to the owner:

\`\`\`compact
ledger {
  @private
  secretKey: Bytes<32>;
  
  @private
  privateBalance: Field;
}
\`\`\`

**Use for:**
- User credentials
- Private balances
- Sensitive personal data

## Hybrid Approach

Most contracts use both:

\`\`\`compact
ledger {
  // Public: anyone can see total messages
  messageCount: Counter;
  
  // Private: only owner sees message contents
  @private
  messages: Map<Field, Opaque<"string">>;
}

export circuit postMessage(content: Opaque<"string">): Void {
  const id = ledger.messageCount.value();
  
  // Public increment
  ledger.messageCount.increment(1);
  
  // Private storage
  ledger.messages.insert(id, content);
}
\`\`\`

## Transitioning Between States

### Disclose: Private → Public
\`\`\`compact
export circuit revealBalance(): Field {
  // Reveal private balance publicly
  return disclose(ledger.privateBalance);
}
\`\`\`

### Commit: Public → Hidden
\`\`\`compact
export circuit hideValue(value: Field): Field {
  // Create commitment (hides value but proves existence)
  return commit(value);
}
\`\`\`
`,

  "midnight://docs/concepts/witnesses": `# Witness Functions

Witnesses provide off-chain data to circuits in Midnight.

## Why Witnesses?

Circuits run in a ZK environment with limitations:
- Cannot make network requests
- Cannot access system time
- Cannot read external files
- Must be deterministic

Witnesses bridge this gap by running off-chain.

## Basic Witness

\`\`\`compact
// Runs off-chain, provides data to circuits
witness getTimestamp(): Field {
  return getCurrentUnixTime();
}

export circuit timedAction(): Void {
  const timestamp = getTimestamp();
  assert(timestamp > ledger.deadline);
  // ... perform action
}
\`\`\`

## Witness with Parameters

\`\`\`compact
witness fetchPrice(asset: Opaque<"string">): Field {
  // Off-chain: call price oracle
  return callPriceOracle(asset);
}

export circuit swap(asset: Opaque<"string">, amount: Field): Void {
  const price = fetchPrice(asset);
  const total = amount * price;
  // ... execute swap
}
\`\`\`

## Private Data Access

Witnesses can access private ledger state:

\`\`\`compact
ledger {
  @private
  secretNonce: Field;
}

witness getNextNonce(): Field {
  const current = ledger.secretNonce;
  return current + 1;
}

export circuit signedOperation(data: Field): Field {
  const nonce = getNextNonce();
  return hash(data, nonce);
}
\`\`\`

## Best Practices

1. **Keep witnesses simple** - Complex logic should be in circuits
2. **Handle failures gracefully** - Witnesses can fail
3. **Don't trust witness data blindly** - Validate in circuits
4. **Cache when possible** - Reduce off-chain calls

## Security Considerations

⚠️ Witnesses are NOT proven in ZK:
- Circuit verifies witness output is used correctly
- But doesn't verify HOW witness computed the value
- Malicious witnesses can provide false data

Always add assertions to validate witness data:

\`\`\`compact
export circuit usePrice(asset: Opaque<"string">): Void {
  const price = fetchPrice(asset);
  
  // Validate witness data
  assert(price > 0);
  assert(price < MAX_REASONABLE_PRICE);
  
  // ... use price
}
\`\`\`
`,

  "midnight://docs/concepts/kachina": `# Kachina Protocol

Kachina is the cryptographic protocol underlying Midnight's privacy features.

## Overview

Kachina enables:
- Private smart contracts with public verifiability
- Composable privacy across contracts
- Efficient on-chain verification

## Architecture

\`\`\`
┌─────────────────┐     ┌─────────────────┐
│   User Wallet   │────▶│  Compact Code   │
└─────────────────┘     └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │   ZK Circuit    │
                        │   (Prover)      │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │     Proof       │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │   Midnight      │
                        │   Validators    │
                        └─────────────────┘
\`\`\`

## Key Concepts

### State Model
- **Public State**: Stored on-chain, visible to all
- **Private State**: Stored off-chain, encrypted
- **Commitments**: On-chain references to private state

### Transaction Flow
1. User prepares transaction locally
2. Prover generates ZK proof
3. Transaction + proof submitted to network
4. Validators verify proof (not re-execute)
5. State updates applied

### Composability
Contracts can interact while preserving privacy:

\`\`\`compact
// Contract A
export circuit transferToken(to: Address, amount: Field): Void {
  // Private transfer logic
}

// Contract B can call Contract A
export circuit atomicSwap(
  tokenA: Address,
  tokenB: Address,
  amountA: Field,
  amountB: Field
): Void {
  // Both transfers happen atomically
  // Privacy preserved for both
}
\`\`\`

## Benefits

1. **Privacy by Default**: All computation is private unless explicitly disclosed
2. **Scalability**: Verification is faster than re-execution
3. **Flexibility**: Developers choose what to reveal
4. **Interoperability**: Works with existing blockchain infrastructure
`,

  "midnight://docs/openzeppelin": `# OpenZeppelin Contracts for Compact

> **Official Documentation**: https://docs.openzeppelin.com/contracts-compact
> **GitHub Repository**: https://github.com/OpenZeppelin/compact-contracts

OpenZeppelin Contracts for Compact is the **official and recommended** library for building secure smart contracts on Midnight. This library provides audited, battle-tested modules for common patterns.

## Installation

\`\`\`bash
# Create project directory
mkdir my-project && cd my-project

# Initialize git and add as submodule
git init && git submodule add https://github.com/OpenZeppelin/compact-contracts.git

# Install dependencies
cd compact-contracts
nvm install && yarn && SKIP_ZK=true yarn compact
\`\`\`

## Available Modules

### Token
- **FungibleToken**: Standard token implementation with transfer, mint, burn
- Recommended for all token contracts on Midnight

### Access Control
- **Ownable**: Single owner access control
- **AccessControl**: Role-based access control

### Security
- **Pausable**: Emergency stop mechanism

## Usage Example

\`\`\`compact
pragma language_version >= 0.16.0;

import CompactStandardLibrary;
import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/access/Ownable" prefix Ownable_;
import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/security/Pausable" prefix Pausable_;
import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/token/FungibleToken" prefix FungibleToken_;

constructor(
  _name: Opaque<"string">,
  _symbol: Opaque<"string">,
  _decimals: Uint<8>,
  _recipient: Either<ZswapCoinPublicKey, ContractAddress>,
  _amount: Uint<128>,
  _initOwner: Either<ZswapCoinPublicKey, ContractAddress>,
) {
  Ownable_initialize(_initOwner);
  FungibleToken_initialize(_name, _symbol, _decimals);
  FungibleToken__mint(_recipient, _amount);
}

export circuit transfer(
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  value: Uint<128>,
): Boolean {
  Pausable_assertNotPaused();
  return FungibleToken_transfer(to, value);
}

export circuit pause(): [] {
  Ownable_assertOnlyOwner();
  Pausable__pause();
}

export circuit unpause(): [] {
  Ownable_assertOnlyOwner();
  Pausable__unpause();
}
\`\`\`

## Compilation

\`\`\`bash
compact compile MyContract.compact artifacts/MyContract
\`\`\`

## Why Use OpenZeppelin?

1. **Security Audited**: Contracts are professionally audited
2. **Battle-Tested**: Used in production across the ecosystem
3. **Official Recommendation**: Midnight's recommended library for tokens
4. **Modularity**: Use only what you need
5. **Best Practices**: Follows Compact language best practices
`,

  "midnight://docs/openzeppelin/token": `# OpenZeppelin FungibleToken

> **This is the official and recommended token standard for Midnight.**

The FungibleToken module provides a complete implementation for fungible tokens on Midnight.

## Features

- ERC20-compatible interface
- Transfer with balance tracking
- Mint and burn operations
- Approval and transferFrom patterns
- Privacy-preserving by default

## Basic Usage

\`\`\`compact
pragma language_version >= 0.16.0;

import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/token/FungibleToken" prefix FungibleToken_;

constructor(
  _name: Opaque<"string">,
  _symbol: Opaque<"string">,
  _decimals: Uint<8>,
  _recipient: Either<ZswapCoinPublicKey, ContractAddress>,
  _initialSupply: Uint<128>,
) {
  FungibleToken_initialize(_name, _symbol, _decimals);
  FungibleToken__mint(_recipient, _initialSupply);
}

// Transfer tokens
export circuit transfer(
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  value: Uint<128>,
): Boolean {
  return FungibleToken_transfer(to, value);
}

// Check balance (witness function for privacy)
witness balanceOf(
  account: Either<ZswapCoinPublicKey, ContractAddress>
): Uint<128> {
  return FungibleToken_balanceOf(account);
}

// Get total supply
witness totalSupply(): Uint<128> {
  return FungibleToken_totalSupply();
}
\`\`\`

## Advanced: With Approval Pattern

\`\`\`compact
// Approve spender
export circuit approve(
  spender: Either<ZswapCoinPublicKey, ContractAddress>,
  value: Uint<128>,
): Boolean {
  return FungibleToken_approve(spender, value);
}

// Transfer from approved account
export circuit transferFrom(
  from: Either<ZswapCoinPublicKey, ContractAddress>,
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  value: Uint<128>,
): Boolean {
  return FungibleToken_transferFrom(from, to, value);
}
\`\`\`

## Mint and Burn (Owner-Only)

\`\`\`compact
import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/access/Ownable" prefix Ownable_;

export circuit mint(
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  amount: Uint<128>,
): [] {
  Ownable_assertOnlyOwner();
  FungibleToken__mint(to, amount);
}

export circuit burn(
  from: Either<ZswapCoinPublicKey, ContractAddress>,
  amount: Uint<128>,
): [] {
  Ownable_assertOnlyOwner();
  FungibleToken__burn(from, amount);
}
\`\`\`
`,

  "midnight://docs/openzeppelin/access": `# OpenZeppelin Access Control

Access control modules for managing permissions in your contracts.

## Ownable

Simple single-owner access control.

\`\`\`compact
pragma language_version >= 0.16.0;

import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/access/Ownable" prefix Ownable_;

constructor(
  _owner: Either<ZswapCoinPublicKey, ContractAddress>,
) {
  Ownable_initialize(_owner);
}

// Only owner can call this
export circuit adminFunction(): [] {
  Ownable_assertOnlyOwner();
  // ... admin logic
}

// Transfer ownership
export circuit transferOwnership(
  newOwner: Either<ZswapCoinPublicKey, ContractAddress>,
): [] {
  Ownable_assertOnlyOwner();
  Ownable_transferOwnership(newOwner);
}

// Renounce ownership (irreversible!)
export circuit renounceOwnership(): [] {
  Ownable_assertOnlyOwner();
  Ownable_renounceOwnership();
}

// Check current owner
witness owner(): Either<ZswapCoinPublicKey, ContractAddress> {
  return Ownable_owner();
}
\`\`\`

## AccessControl (Role-Based)

For contracts needing multiple roles with different permissions.

\`\`\`compact
import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/access/AccessControl" prefix AC_;

// Define role identifiers
const MINTER_ROLE: Bytes<32> = keccak256("MINTER_ROLE");
const PAUSER_ROLE: Bytes<32> = keccak256("PAUSER_ROLE");

constructor(_admin: Either<ZswapCoinPublicKey, ContractAddress>) {
  AC_initialize(_admin);
  AC__grantRole(MINTER_ROLE, _admin);
  AC__grantRole(PAUSER_ROLE, _admin);
}

// Only minters can call
export circuit mint(to: Address, amount: Uint<128>): [] {
  AC_assertOnlyRole(MINTER_ROLE);
  // ... mint logic
}

// Only pausers can call
export circuit pause(): [] {
  AC_assertOnlyRole(PAUSER_ROLE);
  // ... pause logic
}

// Grant role (admin only)
export circuit grantRole(
  role: Bytes<32>,
  account: Either<ZswapCoinPublicKey, ContractAddress>,
): [] {
  AC_assertOnlyRole(AC_DEFAULT_ADMIN_ROLE());
  AC__grantRole(role, account);
}
\`\`\`
`,

  "midnight://docs/openzeppelin/security": `# OpenZeppelin Security Patterns

Security modules for protecting your contracts.

## Pausable

Emergency stop mechanism for your contract.

\`\`\`compact
pragma language_version >= 0.16.0;

import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/security/Pausable" prefix Pausable_;
import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/access/Ownable" prefix Ownable_;

constructor(_owner: Either<ZswapCoinPublicKey, ContractAddress>) {
  Ownable_initialize(_owner);
  // Contract starts unpaused
}

// Protected function - won't work when paused
export circuit transfer(
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  amount: Uint<128>,
): Boolean {
  Pausable_assertNotPaused();
  // ... transfer logic
}

// Owner can pause
export circuit pause(): [] {
  Ownable_assertOnlyOwner();
  Pausable__pause();
}

// Owner can unpause
export circuit unpause(): [] {
  Ownable_assertOnlyOwner();
  Pausable__unpause();
}

// Check if paused
witness isPaused(): Boolean {
  return Pausable_paused();
}
\`\`\`

## Combined Example: Secure Token

\`\`\`compact
pragma language_version >= 0.16.0;

import CompactStandardLibrary;
import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/access/Ownable" prefix Ownable_;
import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/security/Pausable" prefix Pausable_;
import "./compact-contracts/node_modules/@openzeppelin-compact/contracts/src/token/FungibleToken" prefix FungibleToken_;

constructor(
  _name: Opaque<"string">,
  _symbol: Opaque<"string">,
  _decimals: Uint<8>,
  _initialSupply: Uint<128>,
  _owner: Either<ZswapCoinPublicKey, ContractAddress>,
) {
  Ownable_initialize(_owner);
  FungibleToken_initialize(_name, _symbol, _decimals);
  FungibleToken__mint(_owner, _initialSupply);
}

// Pausable transfer
export circuit transfer(
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  value: Uint<128>,
): Boolean {
  Pausable_assertNotPaused();
  return FungibleToken_transfer(to, value);
}

// Owner-only mint
export circuit mint(
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  amount: Uint<128>,
): [] {
  Ownable_assertOnlyOwner();
  Pausable_assertNotPaused();
  FungibleToken__mint(to, amount);
}

// Emergency pause
export circuit pause(): [] {
  Ownable_assertOnlyOwner();
  Pausable__pause();
}

export circuit unpause(): [] {
  Ownable_assertOnlyOwner();
  Pausable__unpause();
}
\`\`\`

## Best Practices

1. **Always use Pausable** for contracts handling value
2. **Combine with Ownable** for admin-only pause control
3. **Test pause scenarios** thoroughly
4. **Document pause conditions** for users
5. **Consider timelock** for unpause in high-value contracts
`,

  "midnight://docs/tokenomics": `# Midnight Tokenomics and Incentives Whitepaper

## Overview

Midnight introduces a novel dual-component tokenomics system with NIGHT (utility token) and DUST (transaction resource), designed for operational predictability, privacy, and cross-chain cooperation.

## Core Pillars

1. **Operational Predictability**: NIGHT generates DUST continuously, enabling transactions without direct token expenditure
2. **Rational Privacy**: DUST is shielded - transactions don't leave metadata trails
3. **Cooperative Tokenomics**: Multi-chain architecture enables cross-chain value creation
4. **Fair Distribution**: Free, multi-phase token distribution (Glacier Drop)

---

## The NIGHT Token

NIGHT is Midnight's native utility token. One NIGHT = 1,000,000 STARs.

### Key Properties

- **Unshielded**: NIGHT transactions are publicly visible on-chain
- **Transferable**: Can be freely transferred, listed on exchanges, bridged across networks
- **Total Supply**: 24 billion NIGHT tokens
- **Non-expendable**: Not consumed to execute transactions
- **Disinflationary**: Circulating supply expansion slows over time
- **Multi-chain Native**: Exists natively on both Cardano (as Native Asset) and Midnight

### Stakeholders

- **NIGHT Token Holders**: Control future network governance
- **Midnight Block Producers (MBPs)**: Validate blocks, receive rewards
- **Midnight Foundation**: Long-term ecosystem development
- **On-chain Treasury**: Protocol-managed fund for ecosystem growth
- **Reserve**: Protocol-managed pool for block production rewards

### Cross-Chain Token States

Tokens can be:
- **Protocol-locked**: Cannot move or generate DUST
- **Protocol-unlocked**: Full utility and transferability

Key invariant: A token unlocked on one chain is locked on the other, ensuring effective supply never exceeds 24 billion.

### Cross-Chain Invariants

\`\`\`
C.R + C.L + C.U = M.R + M.L + M.U = S (24 billion)

Where:
- C = Cardano, M = Midnight
- R = Reserve, L = Locked, U = Unlocked
- S = Total Supply
\`\`\`

---

## The DUST Resource

DUST is the shielded, renewable resource for transaction fees.

### Key Properties

- **Shielded**: Transactions don't expose wallet addresses or details
- **Consumable**: Burned when used (not recycled)
- **Renewable**: Continuously generated by NIGHT holdings
- **Decaying**: Balance decays when disassociated from generating NIGHT
- **Non-transferable**: Cannot be bought, sold, or transferred between addresses
- **MEV-resistant**: Shielding prevents attackers from identifying victims

### DUST Mechanics

**Generation**:
1. NIGHT holder designates a DUST recipient address
2. DUST accumulates linearly over time up to a cap
3. Cap is proportional to associated NIGHT balance

**DUST Cap**: Maximum DUST = f(associated NIGHT balance)

**Usage**:
- DUST is consumed/burned when used
- No DUST is collected by block producers
- Generation resumes after use if below cap

**Decay**:
- Severing NIGHT association causes linear decay
- Prevents double-spending through cap enforcement

### DUST Beneficiaries

1. **NIGHT Holders**: Generate and use their own DUST
2. **DUST Recipients**: Receive DUST generation from NIGHT holders
3. **DUST Sponsees**: Transactions paid by a DUST holder (enables tokenless UX)

---

## Transaction Fees

### Components

\`\`\`
TxFee = CongestionRate × TxWeight + MinFee
\`\`\`

- **Minimum Fee**: Fixed fee preventing DDoS attacks
- **Congestion Rate**: Dynamic multiplier based on network demand
- **Transaction Weight**: Based on computational resources (initially storage in KB)

### Block Utilization Target: 50%

- Below 50%: Fees decrease to stimulate activity
- Above 50%: Fees increase to manage congestion
- Acts as automatic stabilizer for network efficiency

---

## Block Production & Rewards

### At Launch

- Federated block production by trusted permissioned nodes
- Initial producers don't receive rewards
- Progressive decentralization planned

### Moving to Permissionless

- Cardano SPOs can become Midnight Block Producers
- Selection proportional to delegated ADA stake
- Dual-network participation doesn't affect Cardano rewards

### Block Reward Formula

**Base Distribution Rate (R)**:
\`\`\`
R = π(1 - B - T) / (B × γ)

Where:
- π = Initial annual inflation rate (~3.14%)
- B = Reserve allocation percentage
- T = Treasury allocation percentage
- γ = Blocks per year
\`\`\`

**Base Reward**:
\`\`\`
Nb = Bo × R

Where Bo = Outstanding tokens in Reserve
\`\`\`

### Reward Split

Rewards divided between block producer and Treasury based on block utilization:

\`\`\`
Actual Reward (Na) = Nb × [S + (1 - S) × U]
Treasury Share (Nt) = Nb - Na

Where:
- S = Subsidy rate (95% at launch)
- U = Block utilization ratio
\`\`\`

- **Full block**: Producer gets 100% of base reward
- **Empty block**: Producer gets only the subsidy (95%)
- **Partially full**: Linear interpolation between them

---

## Token Distribution

### Design Principles

- **Broad**: No single party dominates
- **Inclusive**: Open to participants beyond crypto
- **Free**: Allocated at no cost
- **Transparent**: Open-source audited smart contracts

### Phase 1: Glacier Drop (60 days)

**Eligible Networks**:
- Cardano (50% allocation)
- Bitcoin (20% allocation)
- Ethereum, Solana, XRPL, BNB Chain, Avalanche, Brave (remaining 30%, proportional)

**Eligibility**:
- Minimum $100 USD equivalent in native tokens at snapshot
- Address not on OFAC sanctions list
- Random historical snapshot to prevent gaming

**Mechanics**:
1. Sign message proving address ownership
2. Provide unused Cardano address for redemption
3. Tokens initially frozen, thaw during redemption period

### Phase 2: Scavenger Mine (30 days)

- Process unclaimed Glacier Drop tokens
- Computational puzzles accessible to general public
- Daily allocation over 30 one-day slots

**Apportionment of Unclaimed Tokens**:
- ~35% → Midnight Foundation
- ~30% → Reserve (block rewards)
- ~10% → Midnight TGE (partnerships/liquidity)
- ~5% → On-chain Treasury
- Rest → Scavenger Mine participants + Lost-and-Found

### Phase 3: Lost-and-Found (4 years)

- Second chance for eligible non-claimers from Glacier Drop
- Fractional allocation of original entitlement
- After 4 years, unclaimed tokens go to Treasury

### Redemption Period (450 days)

**Thawing Schedule**:
- Random start day (1-90 days after genesis)
- 25% unlock at start, then every 90 days
- Total: 4 unlocks over 360 days

---

## Cooperative Tokenomics

### Capacity Marketplace

Enables non-NIGHT holders to access Midnight:

**Off-chain Models**:
- DUST generation leasing
- Broker-managed leasing
- Babel Station (DUST filling station using ZSwap)

**On-chain Models** (future):
- Ledger-native capacity leasing
- On-chain capacity exchange

### Multi-chain Features

**Cross-chain Observability**: Actions on one chain trigger agents on another

**Multichain Signatures**: Treasury can receive fees in other tokens

---

## Governance

### At Launch: Federated

- Select committee with equal powers
- Multisig mechanism for protocol updates
- Handles: parameter updates, protocol upgrades, hard forks

### Future: Decentralized On-chain

- Community-centric tools and processes
- Proposal submission and voting
- Treasury access for approved proposals
- Automated protocol updates

---

## Glossary

- **NIGHT**: Midnight's native utility token
- **STAR**: Smallest subunit of NIGHT (1 NIGHT = 1M STARs)
- **DUST**: Shielded transaction resource
- **MBP**: Midnight Block Producer
- **Reserve**: Protocol-managed token pool for block rewards
- **Treasury**: Protocol-managed fund for ecosystem growth
- **Glacier Drop**: Initial free token distribution
- **Scavenger Mine**: Computational task-based distribution
- **ZSwap**: Atomic asset swap mechanism for privacy
- **Babel Station**: Service enabling tokenless transactions
`,
};
