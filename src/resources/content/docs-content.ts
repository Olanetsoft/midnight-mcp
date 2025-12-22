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
  "midnight://docs/compact-reference": `# Compact Language Quick Reference

A curated syntax reference for Compact - Midnight's smart contract language.

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

export circuit buyAtMarketPrice(maxPrice: Field): Void {
  const price = getCurrentPrice();
  assert(price <= maxPrice);
  // ... execute purchase
}
\`\`\`

### Key Points:
- Run locally, not on-chain
- Can access external APIs, databases
- Cannot modify ledger state directly
- Results are private unless disclosed

## State Management

### Public State
\`\`\`compact
ledger {
  publicCounter: Counter;
  publicMap: Map<Field, Field>;
}
\`\`\`

### Private State
\`\`\`compact
ledger {
  @private
  secretBalance: Field;
  
  @private
  hiddenVotes: Map<Address, Field>;
}
\`\`\`

## Common Patterns

### Access Control
\`\`\`compact
ledger {
  owner: Opaque<"address">;
}

witness getCaller(): Opaque<"address"> {
  return context.caller;
}

export circuit ownerOnly(): Void {
  assert(getCaller() == ledger.owner, "Not owner");
}
\`\`\`

### Disclosure
\`\`\`compact
export circuit revealSecret(): Field {
  const secret = getPrivateData();
  return disclose(secret); // Makes private data public
}
\`\`\`

### Assertions
\`\`\`compact
assert(condition);                    // Basic assertion
assert(condition, "Error message");   // With message
\`\`\`
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
};
