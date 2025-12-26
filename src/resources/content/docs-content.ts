/**
 * Embedded documentation content
 *
 * DESIGN PRINCIPLE: This file contains ONLY curated/unique content that:
 * 1. Doesn't exist in official docs (wallet-integration guide we created)
 * 2. Is a synthesized summary (tokenomics whitepaper)
 * 3. Is a quick reference card (compact-reference, sdk-api)
 * 4. Is from external sources (OpenZeppelin Compact contracts)
 *
 * For official Midnight docs (glossary, Zswap, Kachina concepts),
 * use the search_docs tool which queries the Vector DB.
 */

export const EMBEDDED_DOCS: Record<string, string> = {
  "midnight://docs/compact-reference": `# Compact Language Syntax Reference (v0.16 - v0.18)

> **CRITICAL**: This reference is derived from **actual compiling contracts** in the Midnight ecosystem.
> Always verify syntax against this reference before generating contracts.

## Quick Start Template

Use this as a starting point - it compiles successfully:

\`\`\`compact
pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

// Ledger state (individual declarations, NOT a block)
export ledger counter: Counter;
export ledger owner: Bytes<32>;

// Witness for private/off-chain data
witness local_secret_key(): Bytes<32>;

// Circuit (returns [] not Void)
export circuit increment(): [] {
  counter.increment(1);
}
\`\`\`

---

## 1. Pragma (Version Declaration)

**CORRECT** - use bounded range without patch version:
\`\`\`compact
pragma language_version >= 0.16 && <= 0.18;
\`\`\`

**WRONG** - these will cause parse errors:
\`\`\`compact
pragma language_version >= 0.14.0;           // ❌ patch version not needed
pragma language_version >= 0.16.0 < 0.19.0;  // ❌ wrong operator format
\`\`\`

---

## 2. Imports

Always import the standard library:
\`\`\`compact
import CompactStandardLibrary;
\`\`\`

For multi-file contracts, use \`include\`:
\`\`\`compact
include "types";
include "ledger";
include "circuits";
\`\`\`

---

## 3. Ledger Declarations

**CORRECT** - individual declarations with \`export ledger\`:
\`\`\`compact
export ledger counter: Counter;
export ledger owner: Bytes<32>;
export ledger balances: Map<Bytes<32>, Uint<64>>;

// Private state (off-chain only)
ledger secretValue: Field;  // no export = private
\`\`\`

**WRONG** - block syntax is deprecated:
\`\`\`compact
// ❌ This causes parse error: found "{" looking for an identifier
ledger {
  counter: Counter;
  owner: Bytes<32>;
}
\`\`\`

### Ledger Modifiers

\`\`\`compact
export ledger publicData: Field;           // Public, readable by anyone
export sealed ledger immutableData: Field; // Set once in constructor, cannot change
ledger privateData: Field;                 // Private, not exported
\`\`\`

---

## 4. Data Types

### Primitive Types
| Type | Description | Example |
|------|-------------|---------|
| \`Field\` | Finite field element (basic numeric) | \`amount: Field\` |
| \`Boolean\` | True or false | \`isActive: Boolean\` |
| \`Bytes<N>\` | Fixed-size byte array | \`hash: Bytes<32>\` |
| \`Uint<N>\` | Unsigned integer (N = 8, 16, 32, 64, 128, 256) | \`balance: Uint<64>\` |
| \`Uint<MIN..MAX>\` | Bounded unsigned integer | \`score: Uint<0..100>\` |

### Collection Types
| Type | Description | Example |
|------|-------------|---------|
| \`Counter\` | Incrementable/decrementable | \`count: Counter\` |
| \`Map<K, V>\` | Key-value mapping | \`Map<Bytes<32>, Uint<64>>\` |
| \`Set<T>\` | Unique value collection | \`Set<Bytes<32>>\` |
| \`Vector<N, T>\` | Fixed-size array | \`Vector<3, Field>\` |
| \`List<T>\` | Dynamic list | \`List<Bytes<32>>\` |
| \`Maybe<T>\` | Optional value | \`Maybe<Bytes<32>>\` |
| \`Either<L, R>\` | Union type | \`Either<Field, Bytes<32>>\` |
| \`Opaque<"type">\` | External type from TypeScript | \`Opaque<"string">\` |

### Custom Types

**Enums** - must use \`export\` to access from TypeScript:
\`\`\`compact
export enum GameState { waiting, playing, finished }
export enum Choice { rock, paper, scissors }
\`\`\`

**Structs**:
\`\`\`compact
export struct PlayerConfig {
  name: Opaque<"string">,
  score: Uint<32>,
  isActive: Boolean,
}
\`\`\`

---

## 5. Circuits

Circuits are on-chain functions that generate ZK proofs.

**CRITICAL**: Return type is \`[]\` (empty tuple), NOT \`Void\`:

\`\`\`compact
// CORRECT - returns []
export circuit increment(): [] {
  counter.increment(1);
}

// CORRECT - with parameters
export circuit transfer(to: Bytes<32>, amount: Uint<64>): [] {
  assert(amount > 0, "Amount must be positive");
  // ... logic
}

// CORRECT - with return value
export circuit getBalance(addr: Bytes<32>): Uint<64> {
  return balances.lookup(addr);
}

// WRONG - Void does not exist
export circuit broken(): Void {  // ❌ Parse error
  counter.increment(1);
}
\`\`\`

### Circuit Modifiers

\`\`\`compact
export circuit publicFn(): []      // Callable externally
circuit internalFn(): []           // Internal only, not exported
export pure circuit hash(x: Field): Bytes<32>  // No state access
\`\`\`

---

## 6. Witnesses

Witnesses provide off-chain/private data to circuits. They run locally, not on-chain.

\`\`\`compact
// Basic witness - returns private data
witness local_secret_key(): Bytes<32>;

// Witness with parameters
witness get_merkle_path(leaf: Bytes<32>): MerkleTreePath<10, Bytes<32>>;

// Witness that returns nothing (side effect only)
witness store_locally(data: Field): [];

// Witness returning optional
witness find_user(id: Bytes<32>): Maybe<UserData>;
\`\`\`

---

## 7. Constructor

Optional - initializes sealed ledger fields at deploy time:

\`\`\`compact
export sealed ledger owner: Bytes<32>;
export sealed ledger nonce: Bytes<32>;

constructor(initNonce: Bytes<32>) {
  owner = disclose(public_key(local_secret_key()));
  nonce = disclose(initNonce);
}
\`\`\`

---

## 8. Common Patterns

### Authentication Pattern
\`\`\`compact
witness local_secret_key(): Bytes<32>;

// IMPORTANT: public_key() is NOT a builtin - use this pattern
circuit get_public_key(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:pk:"), sk]);
}

export circuit authenticated_action(): [] {
  const sk = local_secret_key();
  const caller = get_public_key(sk);
  assert(disclose(caller == owner), "Not authorized");
  // ... action
}
\`\`\`

### Commit-Reveal Pattern (COMPLETE, VALIDATED)
\`\`\`compact
pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

// Ledger state
export ledger commitment: Bytes<32>;
export ledger revealed_value: Field;
export ledger is_revealed: Boolean;

// Witnesses for off-chain storage
witness local_secret_key(): Bytes<32>;
witness store_secret_value(v: Field): [];
witness get_secret_value(): Field;

// Helper: compute commitment hash
circuit compute_commitment(value: Field, salt: Bytes<32>): Bytes<32> {
  // Convert Field to Bytes for hashing
  const value_bytes = value as Bytes<32>;
  return persistentHash<Vector<2, Bytes<32>>>([value_bytes, salt]);
}

// Commit phase: store hash on-chain, value off-chain
export circuit commit(value: Field): [] {
  const salt = local_secret_key();
  store_secret_value(value);
  commitment = disclose(compute_commitment(value, salt));
  is_revealed = false;
}

// Reveal phase: verify stored value matches commitment
export circuit reveal(): Field {
  const salt = local_secret_key();
  const value = get_secret_value();
  const expected = compute_commitment(value, salt);
  assert(disclose(expected == commitment), "Value doesn't match commitment");
  assert(disclose(!is_revealed), "Already revealed");
  
  revealed_value = disclose(value);
  is_revealed = true;
  return disclose(value);
}
\`\`\`

### Disclosure in Conditionals
When branching on witness values, wrap comparisons in \`disclose()\`:

\`\`\`compact
// CORRECT
export circuit check(guess: Field): Boolean {
  const secret = get_secret();  // witness
  if (disclose(guess == secret)) {
    return true;
  }
  return false;
}

// WRONG - will not compile
export circuit check_broken(guess: Field): Boolean {
  const secret = get_secret();
  if (guess == secret) {  // ❌ implicit disclosure error
    return true;
  }
  return false;
}
\`\`\`

---

## 9. Common Operations

### Counter Operations
\`\`\`compact
// These work in circuits:
counter.increment(1);
counter.decrement(1);
counter.resetToDefault();

// ⚠️ DOES NOT WORK IN CIRCUITS:
// const val = counter.value();  // ERROR: operation undefined
// Instead, read counter value in TypeScript SDK: ledgerState.counter
\`\`\`

### Map Operations
\`\`\`compact
// These work in circuits:
balances.insert(address, 100);
balances.remove(address);

// ⚠️ DOES NOT WORK IN CIRCUITS:
// const balance = balances.lookup(address);  // ERROR
// const exists = balances.member(address);   // ERROR
// Instead, use witnesses to read values:
witness get_balance(addr: Bytes<32>): Uint<64>;
\`\`\`

### Set Operations
\`\`\`compact
// These work in circuits:
members.insert(address);
members.remove(address);

// ⚠️ DOES NOT WORK IN CIRCUITS:
// const isMember = members.member(address);  // ERROR
// Use witness instead:
witness is_member(addr: Bytes<32>): Boolean;
\`\`\`

### Maybe Operations
\`\`\`compact
const opt: Maybe<Field> = some<Field>(42);
const empty: Maybe<Field> = none<Field>();

if (opt.is_some) {
  const val = opt.value;
}
\`\`\`

### Type Casting
\`\`\`compact
const bytes: Bytes<32> = myField as Bytes<32>;  // Field to Bytes
const num: Uint<64> = myField as Uint<64>;      // Field to Uint (bounds not checked!)
const field: Field = myUint as Field;           // Uint to Field (safe)
\`\`\`

### Hashing
\`\`\`compact
// Persistent hash (same input = same output across calls)
const hash = persistentHash<Vector<2, Bytes<32>>>([data1, data2]);

// Persistent commit (hiding commitment)
const commit = persistentCommit<Field>(value);
\`\`\`

---

## 10. Assertions

\`\`\`compact
assert(condition, "Error message");
assert(amount > 0, "Amount must be positive");
assert(disclose(caller == owner), "Not authorized");
\`\`\`

---

## 11. Common Mistakes to Avoid

| Mistake | Correct |
|---------|---------|
| \`ledger { field: Type; }\` | \`export ledger field: Type;\` |
| \`circuit fn(): Void\` | \`circuit fn(): []\` |
| \`pragma >= 0.16.0\` | \`pragma >= 0.16 && <= 0.18\` |
| \`enum State { ... }\` | \`export enum State { ... }\` |
| \`if (witness_val == x)\` | \`if (disclose(witness_val == x))\` |
| \`Cell<Field>\` | \`Field\` (Cell is deprecated) |
| \`myValue.read()\` / \`.write()\` | Direct assignment: \`myValue = x\` |

---

## 12. Exports for TypeScript

To use types/values in TypeScript, they must be exported:

\`\`\`compact
// These are accessible from TypeScript
export enum GameState { waiting, playing }
export struct Config { value: Field }
export ledger counter: Counter;
export circuit play(): []

// Standard library re-exports (if needed in TS)
export { Maybe, Either, CoinInfo };
\`\`\`

---

## Reference Contracts

These contracts compile successfully and demonstrate correct patterns:

1. **Counter** (beginner): \`midnightntwrk/example-counter\`
2. **Bulletin Board** (intermediate): \`midnightntwrk/example-bboard\`  
3. **Naval Battle Game** (advanced): \`ErickRomeroDev/naval-battle-game_v2\`
4. **Sea Battle** (advanced): \`bricktowers/midnight-seabattle\`

When in doubt, reference these repos for working syntax.
`,

  "midnight://docs/sdk-api": `# Midnight TypeScript SDK Quick Reference

## Installation

\`\`\`bash
npm install @midnight-ntwrk/midnight-js-contracts
\`\`\`

## Core Types

### Contract Deployment

\`\`\`typescript
import { deployContract, ContractDeployment } from '@midnight-ntwrk/midnight-js-contracts';

const deployment: ContractDeployment = await deployContract({
  contract: compiledContract,
  privateState: initialPrivateState,
  args: constructorArgs,
});

const { contractAddress, initialState } = deployment;
\`\`\`

### Contract Interaction

\`\`\`typescript
import { callContract } from '@midnight-ntwrk/midnight-js-contracts';

// Call a circuit
const result = await callContract({
  contractAddress,
  circuitName: 'increment',
  args: [amount],
  privateState: currentPrivateState,
});

// Result contains new state and return value
const { newPrivateState, returnValue, proof } = result;
\`\`\`

### Providers

\`\`\`typescript
import { 
  MidnightProvider,
  createMidnightProvider 
} from '@midnight-ntwrk/midnight-js-contracts';

const provider = await createMidnightProvider({
  indexer: 'https://indexer.testnet.midnight.network',
  node: 'https://node.testnet.midnight.network',
  proofServer: 'https://prover.testnet.midnight.network',
});
\`\`\`

## State Management

\`\`\`typescript
interface ContractState<T> {
  publicState: PublicState;
  privateState: T;
}

// Subscribe to state changes
provider.subscribeToContract(contractAddress, (state) => {
  console.log('New state:', state);
});
\`\`\`

## Transaction Building

\`\`\`typescript
import { buildTransaction } from '@midnight-ntwrk/midnight-js-contracts';

const tx = await buildTransaction({
  contractAddress,
  circuitName: 'transfer',
  args: [recipient, amount],
  privateState,
});

// Sign and submit
const signedTx = await wallet.signTransaction(tx);
const txHash = await provider.submitTransaction(signedTx);
\`\`\`

## Error Handling

\`\`\`typescript
import { MidnightError, ContractError } from '@midnight-ntwrk/midnight-js-contracts';

try {
  await callContract({ ... });
} catch (error) {
  if (error instanceof ContractError) {
    console.error('Contract assertion failed:', error.message);
  } else if (error instanceof MidnightError) {
    console.error('Network error:', error.code);
  }
}
\`\`\`
`,

  "midnight://docs/openzeppelin": `# OpenZeppelin Contracts for Compact

> **Official Documentation**: https://docs.openzeppelin.com/contracts-compact
> **GitHub Repository**: https://github.com/OpenZeppelin/compact-contracts

The official OpenZeppelin library for Midnight smart contracts provides battle-tested, audited implementations of common patterns.

## Installation

\`\`\`bash
npm install @openzeppelin/compact-contracts
\`\`\`

## Available Modules

### Token Standards
- **FungibleToken** - Privacy-preserving token with shielded balances
- **NFT** - Non-fungible tokens with optional privacy

### Access Control
- **Ownable** - Single-owner access pattern
- **Roles** - Role-based access control
- **AccessControl** - Flexible permission system

### Security
- **Pausable** - Emergency stop mechanism
- **ReentrancyGuard** - Prevent reentrancy attacks

## Usage Example

\`\`\`compact
include "std";
include "@openzeppelin/compact-contracts/token/FungibleToken.compact";
include "@openzeppelin/compact-contracts/access/Ownable.compact";

ledger {
  // Inherit from OpenZeppelin contracts
  ...FungibleToken.ledger;
  ...Ownable.ledger;
}

export circuit mint(to: Address, amount: Field): Void {
  Ownable.assertOnlyOwner();
  FungibleToken.mint(to, amount);
}
\`\`\`

## Best Practices

1. **Always use audited contracts** - Don't reinvent token standards
2. **Combine patterns** - Ownable + FungibleToken + Pausable
3. **Check for updates** - Security patches are released regularly
4. **Read the docs** - Each module has specific usage patterns
`,

  "midnight://docs/openzeppelin/token": `# OpenZeppelin FungibleToken

The recommended standard for privacy-preserving tokens on Midnight.

## Features

- Shielded balances (private by default)
- Optional public balance disclosure
- Transfer with ZK proofs
- Mint/burn capabilities

## Basic Usage

\`\`\`compact
include "std";
include "@openzeppelin/compact-contracts/token/FungibleToken.compact";

ledger {
  ...FungibleToken.ledger;
  name: Opaque<"string">;
  symbol: Opaque<"string">;
  decimals: Uint<8>;
}

export circuit initialize(
  name: Opaque<"string">,
  symbol: Opaque<"string">,
  decimals: Uint<8>,
  initialSupply: Field,
  owner: Address
): Void {
  ledger.name = name;
  ledger.symbol = symbol;
  ledger.decimals = decimals;
  FungibleToken.mint(owner, initialSupply);
}

// Shielded transfer
export circuit transfer(to: Address, amount: Field): Void {
  FungibleToken.transfer(to, amount);
}

// Check balance (private)
witness myBalance(): Field {
  return FungibleToken.balanceOf(context.caller);
}

// Reveal balance publicly (optional)
export circuit revealBalance(): Field {
  return disclose(myBalance());
}
\`\`\`

## Minting and Burning

\`\`\`compact
include "@openzeppelin/compact-contracts/access/Ownable.compact";

ledger {
  ...FungibleToken.ledger;
  ...Ownable.ledger;
}

export circuit mint(to: Address, amount: Field): Void {
  Ownable.assertOnlyOwner();
  FungibleToken.mint(to, amount);
}

export circuit burn(amount: Field): Void {
  FungibleToken.burn(context.caller, amount);
}
\`\`\`

## Privacy Model

| Operation | Privacy |
|-----------|---------|
| Balance | Shielded (private) |
| Transfer amount | Shielded |
| Sender | Shielded |
| Recipient | Shielded |
| Transaction occurred | Public (proof exists) |

## Important Notes

1. **No approval mechanism** - Unlike ERC20, transfers are direct
2. **Balances are commitments** - Not stored as plain values
3. **Privacy by default** - Explicit disclosure required to reveal
`,

  "midnight://docs/openzeppelin/access": `# OpenZeppelin Access Control

Patterns for controlling who can call contract functions.

## Ownable

Simple single-owner access control.

\`\`\`compact
include "@openzeppelin/compact-contracts/access/Ownable.compact";

ledger {
  ...Ownable.ledger;
}

export circuit initialize(owner: Address): Void {
  Ownable.initialize(owner);
}

export circuit adminFunction(): Void {
  Ownable.assertOnlyOwner();
  // Only owner can execute this
}

export circuit transferOwnership(newOwner: Address): Void {
  Ownable.assertOnlyOwner();
  Ownable.transferOwnership(newOwner);
}
\`\`\`

## Role-Based Access Control

For more complex permission systems.

\`\`\`compact
include "@openzeppelin/compact-contracts/access/AccessControl.compact";

ledger {
  ...AccessControl.ledger;
}

const ADMIN_ROLE: Bytes<32> = keccak256("ADMIN_ROLE");
const MINTER_ROLE: Bytes<32> = keccak256("MINTER_ROLE");

export circuit initialize(admin: Address): Void {
  AccessControl.grantRole(ADMIN_ROLE, admin);
  AccessControl.setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
}

export circuit mint(to: Address, amount: Field): Void {
  AccessControl.assertHasRole(MINTER_ROLE);
  // Mint tokens
}

export circuit grantMinterRole(account: Address): Void {
  AccessControl.assertHasRole(ADMIN_ROLE);
  AccessControl.grantRole(MINTER_ROLE, account);
}
\`\`\`

## Combining Patterns

\`\`\`compact
include "@openzeppelin/compact-contracts/access/Ownable.compact";
include "@openzeppelin/compact-contracts/security/Pausable.compact";

ledger {
  ...Ownable.ledger;
  ...Pausable.ledger;
}

export circuit criticalFunction(): Void {
  Ownable.assertOnlyOwner();
  Pausable.assertNotPaused();
  // Execute critical logic
}

export circuit pause(): Void {
  Ownable.assertOnlyOwner();
  Pausable.pause();
}
\`\`\`
`,

  "midnight://docs/openzeppelin/security": `# OpenZeppelin Security Patterns

Security utilities for Compact contracts.

## Pausable

Emergency stop mechanism for contracts.

\`\`\`compact
include "@openzeppelin/compact-contracts/security/Pausable.compact";
include "@openzeppelin/compact-contracts/access/Ownable.compact";

ledger {
  ...Pausable.ledger;
  ...Ownable.ledger;
}

export circuit transfer(to: Address, amount: Field): Void {
  Pausable.assertNotPaused();
  // Transfer logic
}

export circuit pause(): Void {
  Ownable.assertOnlyOwner();
  Pausable.pause();
}

export circuit unpause(): Void {
  Ownable.assertOnlyOwner();
  Pausable.unpause();
}
\`\`\`

## When to Use Pausable

- Token contracts handling real value
- DeFi protocols with liquidity
- Contracts with upgrade mechanisms
- Any contract where bugs could cause fund loss

## Implementation Details

\`\`\`compact
// Pausable module internals (simplified)
ledger {
  paused: Boolean;
}

circuit Pausable_assertNotPaused(): Void {
  assert(!ledger.paused, "Contract is paused");
}

circuit Pausable_pause(): Void {
  ledger.paused = true;
}

circuit Pausable_unpause(): Void {
  ledger.paused = false;
}
\`\`\`

## Best Practices

1. **Always use Pausable** for contracts handling value
2. **Combine with Ownable** for admin-only pause control
3. **Test pause scenarios** thoroughly
4. **Document pause conditions** for users
5. **Consider timelock** for unpause in high-value contracts
`,

  "midnight://docs/tokenomics": `# Midnight Tokenomics Summary

A curated summary of the Midnight Tokenomics Whitepaper (June 2025).

## Dual-Token Model

Midnight uses two components: **NIGHT** (token) and **DUST** (resource).

### NIGHT Token
- **Supply**: 24 billion (fixed)
- **Subunit**: 1 NIGHT = 1,000,000 STARs
- **Visibility**: Unshielded (public)
- **Function**: Generates DUST, governance, block rewards
- **Multi-chain**: Native on both Cardano and Midnight

### DUST Resource
- **Type**: Shielded, non-transferable
- **Function**: Pay transaction fees
- **Generation**: Continuously from NIGHT holdings
- **Decay**: When disassociated from NIGHT
- **Privacy**: Transactions don't leak metadata

## Key Insight: NIGHT Generates DUST

\`\`\`
Hold NIGHT → Generates DUST → Pay for transactions
         (continuous)      (consumed on use)
\`\`\`

This means: **Hold NIGHT, transact "for free"** (no recurring token spend)

## Block Rewards

**Formula**:
\`\`\`
Actual Reward = Base Reward × [S + (1-S) × U]

Where:
- S = Subsidy rate (95% at launch)
- U = Block utilization (target: 50%)
\`\`\`

- Full blocks: Producer gets 100% of base reward
- Empty blocks: Producer gets only subsidy (95%)
- Remainder goes to Treasury

## Token Distribution

### Phase 1: Glacier Drop (60 days)
- Free allocation to crypto holders
- 50% to Cardano, 20% to Bitcoin, 30% to others
- Minimum $100 USD equivalent required

### Phase 2: Scavenger Mine (30 days)  
- Computational puzzles (accessible to public)
- Claims unclaimed Glacier Drop tokens
- Seeds network constituents

### Phase 3: Lost-and-Found (4 years)
- Second chance for Glacier Drop eligible
- Fractional allocation

## Key Differentiators

1. **No token spend for transactions** - DUST is renewable
2. **MEV resistant** - Shielded transactions
3. **Cross-chain native** - Same token on Cardano + Midnight
4. **Fair distribution** - Free, multi-phase, broad eligibility
`,

  "midnight://docs/wallet-integration": `# Midnight Wallet Integration Guide

A guide for integrating Midnight Lace wallet into your DApp.

## Browser Detection

\`\`\`typescript
declare global {
  interface Window {
    midnight?: {
      mnLace?: MidnightProvider;
    };
  }
}

function isWalletAvailable(): boolean {
  return typeof window !== 'undefined' 
    && window.midnight?.mnLace !== undefined;
}
\`\`\`

## DApp Connector API

\`\`\`typescript
interface DAppConnectorAPI {
  enable(): Promise<MidnightAPI>;
  isEnabled(): Promise<boolean>;
  apiVersion(): string;
  name(): string;
  icon(): string;
}

async function connectWallet(): Promise<MidnightAPI> {
  if (!window.midnight?.mnLace) {
    throw new Error('Midnight Lace wallet not found');
  }
  return await window.midnight.mnLace.enable();
}
\`\`\`

## MidnightAPI Interface

\`\`\`typescript
interface MidnightAPI {
  getUsedAddresses(): Promise<string[]>;
  getBalance(): Promise<Balance>;
  signTx(tx: Transaction): Promise<SignedTransaction>;
  submitTx(signedTx: SignedTransaction): Promise<TxHash>;
  signData(address: string, payload: string): Promise<Signature>;
}
\`\`\`

## React Hook

\`\`\`typescript
export function useWallet() {
  const [state, setState] = useState({
    isConnected: false,
    address: null as string | null,
    isLoading: false,
    error: null as string | null,
  });

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      if (!window.midnight?.mnLace) {
        throw new Error('Please install Midnight Lace wallet');
      }
      const api = await window.midnight.mnLace.enable();
      const addresses = await api.getUsedAddresses();
      setState({
        isConnected: true,
        address: addresses[0] || null,
        isLoading: false,
        error: null,
      });
      return api;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed',
      }));
      throw error;
    }
  }, []);

  return { ...state, connect };
}
\`\`\`

## Connection Flow

\`\`\`
1. User clicks "Connect Wallet"
2. DApp calls window.midnight.mnLace.enable()
3. Wallet popup asks user to approve
4. User approves → DApp receives MidnightAPI
5. DApp can now interact with wallet
\`\`\`

## Best Practices

1. Always check wallet availability first
2. Handle user rejection gracefully
3. Store connection state in context
4. Provide clear loading/error feedback
5. Test with Midnight Lace extension
`,

  // Common Errors Reference - VERIFIED from official Midnight documentation
  "midnight://docs/common-errors": `# Common Midnight Errors & Solutions

Verified error messages from official Midnight documentation.

## Version Mismatch Errors

**Source:** [Fix version mismatch errors guide](https://docs.midnight.network/how-to/fix-version-mismatches)

Version mismatches occur when Midnight components are out of sync:
- Compact compiler
- Runtime libraries (@midnight-ntwrk/compact-runtime, @midnight-ntwrk/ledger)
- Proof server
- Indexer

### "Version mismatch" / CompactError
\`\`\`javascript
// The runtime checks version compatibility on startup
throw new __compactRuntime.CompactError(\`Version mismatch...\`);
\`\`\`

**Fix:** Check versions and update all components together:
\`\`\`bash
# Check your versions
compact --version
npm list @midnight-ntwrk/compact-runtime
npm list @midnight-ntwrk/ledger

# Consult the compatibility matrix
# https://docs.midnight.network/relnotes/support-matrix
\`\`\`

## Compact Compiler Errors

### "invalid context for a ledger ADT type"
**Source:** Compact 0.15/0.23 release notes

Ledger ADT types (Counter, Map, etc.) cannot be used as Compact types in casts.

\`\`\`compact
// ❌ Wrong - casting to ledger ADT type
const x = value as Counter;  // Error!

// ✅ Correct - use the ledger field directly
ledger.counter.increment(1);
\`\`\`

### "static type error" - argument count/type mismatch
**Source:** Compact runtime type checks

\`\`\`javascript
// Runtime validates argument counts
if (args_1.length !== 2)
  throw new __compactRuntime.CompactError(
    \`post: expected 2 arguments, received \${args_1.length}\`
  );
\`\`\`

**Fix:** Ensure TypeScript calls match circuit signatures exactly.

### assert() failures
**Source:** [Compact language reference](https://docs.midnight.network/develop/reference/compact/lang-ref)

\`\`\`compact
// Assert syntax (Compact 0.16+)
assert(condition, "error message");

// Example from bboard tutorial
assert(ledger.state == State.VACANT, "Attempted to post to an occupied board");
\`\`\`

**Note:** If assertion fails, the transaction fails without reaching the chain.

## TypeScript SDK Errors

### ContractTypeError
**Source:** @midnight-ntwrk/midnight-js-contracts

Thrown when there's a contract type mismatch between the given contract type
and the initial state deployed at a contract address.

\`\`\`typescript
// Typically thrown by findDeployedContract()
try {
  const contract = await findDeployedContract(provider, address, MyContract);
} catch (e) {
  if (e instanceof ContractTypeError) {
    // The contract at this address is a different type
    console.error('Contract type mismatch:', e.circuitIds);
  }
}
\`\`\`

### type_error() - Runtime type errors
**Source:** @midnight-ntwrk/compact-runtime

Internal function for type errors with parameters: who, what, where, type, value.

## DApp Connector Errors

**Source:** @midnight-ntwrk/dapp-connector-api ErrorCodes

\`\`\`typescript
import { ErrorCodes } from '@midnight-ntwrk/dapp-connector-api';

// ErrorCodes.Rejected - User rejected the request
// ErrorCodes.InvalidRequest - Malformed transaction or request
// ErrorCodes.InternalError - DApp connector couldn't process request

try {
  const api = await window.midnight.mnLace.enable();
} catch (error) {
  if (error.code === ErrorCodes.Rejected) {
    console.log('User rejected wallet connection');
  }
}
\`\`\`

## Node.js Environment Errors

### ERR_UNSUPPORTED_DIR_IMPORT
**Source:** [BBoard tutorial troubleshooting](https://docs.midnight.network/develop/tutorial/3-creating/bboard-dapp)

Occurs due to environment caching after modifying shell config or changing Node versions.

**Fix:**
\`\`\`bash
# 1. Open a NEW terminal window (don't just source ~/.zshrc)
# 2. Verify Node version
nvm use 18

# 3. Clear cached modules
rm -rf node_modules/.cache
\`\`\`

## Transaction Errors

### INSUFFICIENT_FUNDS / Not enough tDUST
**Source:** Midnight documentation examples

\`\`\`typescript
try {
  const result = await sdk.sendTransaction(options);
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    console.error('Not enough tDUST in wallet');
    // Direct user to testnet faucet
  }
}
\`\`\`

## Debugging Resources

1. **Compatibility Matrix:** [/relnotes/support-matrix](https://docs.midnight.network/relnotes/support-matrix)
2. **Discord:** #developer-support channel
3. **Recompile after updates:**
   \`\`\`bash
   rm -rf contract/*.cjs contract/*.prover contract/*.verifier
   compact compile src/contract.compact contract/
   \`\`\`
`,
};
