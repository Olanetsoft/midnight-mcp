/**
 * Embedded code examples and templates
 * Separated from code.ts for better maintainability
 */

export const EMBEDDED_CODE: Record<string, string> = {
  "midnight://code/examples/counter": `// Counter Example Contract
// A simple contract demonstrating basic Compact concepts

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

// Public counter - visible to everyone
export ledger counter: Counter;

// Track last modifier (public)
export ledger lastModifier: Opaque<"address">;

// Increment the counter
export circuit increment(amount: Uint<16>): Uint<64> {
  // Validate input
  assert(amount > 0 as Uint<16>, "Amount must be positive");
  assert(amount <= 100 as Uint<16>, "Amount too large");
  
  // Update counter
  counter.increment(amount);
  
  // Return new value
  return counter.read();
}

// Decrement the counter
export circuit decrement(amount: Uint<16>): Uint<64> {
  // Validate input
  assert(amount > 0 as Uint<16>, "Amount must be positive");
  assert(counter.read() >= (amount as Uint<64>), "Counter would go negative");
  
  // Update counter
  counter.decrement(amount);
  
  // Return new value
  return counter.read();
}

// Read current value (view function)
export circuit getValue(): Uint<64> {
  return counter.read();
}

// Check if counter is below threshold
export circuit isLessThan(threshold: Uint<64>): Boolean {
  return counter.lessThan(threshold);
}
`,

  "midnight://code/examples/bboard": `// Bulletin Board Example Contract
// Demonstrates private messaging with selective disclosure

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

// Public: message count and IDs
export ledger messageCount: Counter;
export ledger messageIds: Set<Field>;

// Private: actual message contents (no export = private)
ledger messages: Map<Field, Opaque<"string">>;

// Private: message authors (stored as Bytes<32> addresses)
ledger authors: Map<Field, Bytes<32>>;

// Witness to fetch message content
witness getMessageContent(id: Field): Opaque<"string">;

// Post a new message (content is private)
export circuit postMessage(content: Opaque<"string">, author: Bytes<32>): Uint<64> {
  // Generate unique message ID using counter read
  const messageId = messageCount.read();
  
  // Store message privately
  messages.insert(messageId as Field, content);
  authors.insert(messageId as Field, author);
  
  // Update public counters
  messageCount.increment(1);
  messageIds.insert(messageId as Field);
  
  return messageId;
}

// Reveal a message publicly (owner's choice)
export circuit revealMessage(id: Field): Opaque<"string"> {
  assert(messageIds.member(id), "Message not found");
  
  const content = getMessageContent(id);
  return disclose(content);
}

// Get total message count
export circuit getMessageCount(): Uint<64> {
  return messageCount.read();
}
`,

  "midnight://code/patterns/state-management": `// State Management Pattern
// Best practices for managing public and private state

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

// PUBLIC STATE
// - Use 'export ledger' for data that should be transparent
// - Visible in blockchain explorers
// - Can be queried by anyone

export ledger totalSupply: Uint<64>;
export ledger publicConfig: Field;

// PRIVATE STATE
// - Use 'ledger' without export for sensitive user data
// - Only owner can read
// - Requires witnesses to access in circuits

ledger userSecrets: Map<Opaque<"address">, Bytes<32>>;
ledger privateBalances: Map<Opaque<"address">, Field>;

// Witnesses for private data access
witness getUserSecret(user: Opaque<"address">): Bytes<32>;
witness getPrivateBalance(user: Opaque<"address">): Field;

// Reading public state is straightforward
export circuit getTotalSupply(): Uint<64> {
  return ledger.totalSupply;
}

// Using private state in a circuit
export circuit proveSecretKnowledge(
  user: Opaque<"address">,
  secretHash: Bytes<32>
): Boolean {
  const secret = getUserSecret(user);
  
  // Prove knowledge without revealing secret
  assert(persistentHash(secret) == secretHash, "Invalid secret");
  return true;
}

// Selective disclosure pattern
export circuit revealBalance(user: Opaque<"address">): Field {
  const balance = getPrivateBalance(user);
  // Explicitly reveal - user's choice
  return disclose(balance);
}
`,

  "midnight://code/patterns/access-control": `// Access Control Pattern
// Implementing permissions and authorization

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

// Role definitions
export ledger owner: Opaque<"address">;
export ledger admins: Set<Opaque<"address">>;

// Access-controlled state
export ledger sensitiveData: Field;

// Private admin keys
ledger adminKeys: Map<Opaque<"address">, Bytes<32>>;

// Witness to get caller identity
witness getCaller(): Opaque<"address">;

// Only owner can call
export circuit onlyOwnerAction(newValue: Field): [] {
  const caller = getCaller();
  assert(caller == owner, "Not owner");
  
  sensitiveData = newValue;
}

// Only admins can call
export circuit onlyAdminAction(data: Field): [] {
  const caller = getCaller();
  assert(admins.member(caller), "Not admin");
  
  // Admin action here
}

// Multi-sig pattern (require multiple approvals)
witness getApprovalCount(action: Bytes<32>): Field;

export circuit requireMultisig(action: Bytes<32>, threshold: Field): Boolean {
  const approvals = getApprovalCount(action);
  assert(approvals >= threshold, "Insufficient approvals");
  return true;
}

// Time-locked action
witness getCurrentTime(): Field;

export circuit timeLockedAction(unlockTime: Field): [] {
  const currentTime = getCurrentTime();
  assert(currentTime >= unlockTime, "Action is timelocked");
  
  // Perform action
}
`,

  "midnight://code/patterns/privacy-preserving": `// Privacy-Preserving Patterns
// Techniques for maintaining privacy in smart contracts

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

// Commitment-based private balance
export ledger balanceCommitments: Map<Opaque<"address">, Field>;

// Nullifier set (prevents double-spending)
export ledger nullifiers: Set<Field>;

// Private state
ledger secretBalances: Map<Opaque<"address">, Field>;
ledger secretNonces: Map<Opaque<"address">, Field>;

// Witnesses for private state
witness getSecretBalance(user: Opaque<"address">): Field;
witness getSecretNonce(user: Opaque<"address">): Field;

// PATTERN 1: Commitment Scheme
// Store commitments instead of values

export circuit deposit(
  user: Opaque<"address">,
  amount: Field,
  nonce: Field
): Field {
  // Create commitment: hash(amount || nonce)
  // Use a struct to combine values into a single hashable input
  struct CommitmentInput { amount: Field, nonce: Field }
  const input = CommitmentInput { amount: amount, nonce: nonce };
  const commitment = persistentHash<Field>(input);
  
  // Store commitment (hides amount)
  balanceCommitments.insert(user, commitment);
  
  return commitment;
}

export circuit proveBalance(
  user: Opaque<"address">,
  amount: Field,
  nonce: Field,
  minBalance: Field
): Boolean {
  // Verify commitment
  struct CommitmentInput { amount: Field, nonce: Field }
  const input = CommitmentInput { amount: amount, nonce: nonce };
  const expectedCommitment = persistentHash<Field>(input);
  assert(balanceCommitments.lookup(user) == expectedCommitment, "Invalid commitment");
  
  // Prove property without revealing value
  assert(amount >= minBalance, "Insufficient balance");
  return true;
}

// PATTERN 2: Nullifiers (Prevent Double-Spending)

witness generateNullifier(secret: Bytes<32>, action: Field): Field;

export circuit spendOnce(
  secret: Bytes<32>,
  action: Field
): [] {
  const nullifier = generateNullifier(secret, action);
  
  // Check nullifier hasn't been used
  assert(!nullifiers.member(nullifier), "Already spent");
  
  // Mark as used
  nullifiers.insert(nullifier);
  
  // Perform action
}

// PATTERN 3: Range Proofs

export circuit proveInRange(
  value: Field,
  min: Field,
  max: Field
): Boolean {
  // Prove value is in range without revealing it
  assert(value >= min, "Below minimum");
  assert(value <= max, "Above maximum");
  return true;
}

// PATTERN 4: Private Set Membership

witness computeMerkleRoot(element: Field, proof: Vector<10, Field>): Field;

export circuit proveMembership(
  element: Field,
  setRoot: Field,
  proof: Vector<10, Field>
): Boolean {
  // Prove element is in set without revealing which element
  const computedRoot = computeMerkleRoot(element, proof);
  assert(computedRoot == setRoot, "Invalid membership proof");
  return true;
}
`,

  "midnight://code/templates/token": `// Privacy-Preserving Token Template
// Starter template for token contracts with privacy features

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

// Public token metadata
export ledger name: Bytes<32>;
export ledger symbol: Bytes<8>;
export ledger decimals: Uint<8>;
export ledger totalSupply: Uint<64>;

// Private balances
ledger balances: Map<Opaque<"address">, Uint<64>>;

// Witnesses for private state access
witness getBalance(account: Opaque<"address">): Uint<64>;
witness getCaller(): Opaque<"address">;

// Transfer tokens privately
export circuit transfer(
  to: Opaque<"address">,
  amount: Uint<64>
): Boolean {
  const from = getCaller();
  const fromBalance = getBalance(from);
  
  // Validate
  assert(amount > 0, "Invalid amount");
  assert(fromBalance >= amount, "Insufficient balance");
  
  // Update balances privately
  balances.insert(from, fromBalance - amount);
  balances.insert(to, getBalance(to) + amount);
  
  return true;
}

// Reveal balance (user's choice)
export circuit revealMyBalance(): Uint<64> {
  const caller = getCaller();
  const balance = getBalance(caller);
  return disclose(balance);
}

// Get total supply
witness getTotalSupply(): Uint<64> {
  return ledger.totalSupply;
}

// Mint new tokens (admin only)
export circuit mint(to: Opaque<"address">, amount: Uint<64>): Boolean {
  // Add access control in production
  balances.insert(to, getBalance(to) + amount);
  ledger.totalSupply = getTotalSupply() + amount;
  return true;
}
`,

  "midnight://code/templates/voting": `// Private Voting Template
// Starter template for privacy-preserving voting contracts

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

// Public: proposal metadata
export ledger proposalCount: Counter;
export ledger proposals: Map<Uint<64>, Bytes<256>>;
export ledger votingDeadlines: Map<Uint<64>, Uint<64>>;

// Private: individual votes
ledger votes: Map<Uint<64>, Map<Opaque<"address">, Uint<8>>>;

// Nullifiers to prevent double voting
export ledger voteNullifiers: Set<Bytes<32>>;

// Eligible voters
export ledger eligibleVoters: Set<Opaque<"address">>;

// Witnesses
witness getCaller(): Opaque<"address">;
witness getCurrentTime(): Uint<64>;
witness getVote(proposalId: Uint<64>, voter: Opaque<"address">): Uint<8>;
witness computeNullifier(voter: Opaque<"address">, proposalId: Uint<64>): Bytes<32>;

// Create a new proposal
export circuit createProposal(
  description: Bytes<256>,
  deadline: Uint<64>
): Uint<64> {
  const proposalId = proposalCount.read();
  
  // Store proposal - proposalId is Uint<64> from Counter.read()
  proposals.insert(proposalId, description);
  votingDeadlines.insert(proposalId, deadline);
  
  proposalCount.increment(1);
  return proposalId;
}

// Cast a private vote
export circuit vote(
  proposalId: Uint<64>,
  option: Uint<8>
): Boolean {
  const voter = getCaller();
  const currentTime = getCurrentTime();
  
  // Check eligibility
  assert(eligibleVoters.member(voter), "Not eligible to vote");
  
  // Check deadline
  const deadline = votingDeadlines.lookup(proposalId);
  assert(currentTime < deadline, "Voting ended");
  
  // Check for double voting using nullifier
  const nullifier = computeNullifier(voter, proposalId);
  assert(!voteNullifiers.member(nullifier), "Already voted");
  
  // Add nullifier to prevent double voting
  voteNullifiers.insert(nullifier);
  
  return true;
}

// Reveal individual vote (voter's choice)
export circuit revealMyVote(proposalId: Uint<32>): Uint<8> {
  const voter = getCaller();
  const myVote = getVote(proposalId, voter);
  return disclose(myVote);
}

// Add eligible voter (admin only)
export circuit addVoter(voter: Opaque<"address">): [] {
  // Add access control in real implementation
  eligibleVoters.insert(voter);
}
`,

  "midnight://code/examples/nullifier": `// Nullifier Pattern Example
// Demonstrates how to create and use nullifiers to prevent double-spending/actions

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

// Set of used nullifiers - prevents replay attacks
export ledger usedNullifiers: Set<Bytes<32>>;

// Track claimed rewards
export ledger claimedRewards: Counter;

// Hash function for creating nullifiers
// Combines secret + public data to create unique identifier
witness computeNullifier(secret: Field, commitment: Field): Bytes<32>;

// Alternative: nullifier from address and action ID
witness computeActionNullifier(userSecret: Field, actionId: Field): Bytes<32>;

// Claim a reward (can only claim once per user)
// Note: rewardAmount is Uint<16> to match Counter.increment signature
export circuit claimReward(
  secret: Field,
  commitment: Field,
  rewardAmount: Uint<16>
): Boolean {
  // Compute the nullifier
  const nullifier = computeNullifier(secret, commitment);
  
  // Check nullifier hasn't been used (prevents double-claim)
  assert(
    !usedNullifiers.member(nullifier), 
    "Reward already claimed"
  );
  
  // Mark nullifier as used
  usedNullifiers.insert(nullifier);
  
  // Process reward (Counter.increment takes Uint<16>)
  claimedRewards.increment(rewardAmount);
  
  return true;
}

// Vote with nullifier (prevents double-voting)
export circuit voteWithNullifier(
  voterSecret: Field,
  proposalId: Field,
  vote: Field
): Boolean {
  // Create unique nullifier for this voter + proposal
  const nullifier = computeActionNullifier(voterSecret, proposalId);
  
  // Ensure hasn't voted on this proposal
  assert(
    !usedNullifiers.member(nullifier),
    "Already voted on this proposal"
  );
  
  // Record nullifier
  usedNullifiers.insert(nullifier);
  
  // Process vote...
  return true;
}
`,

  "midnight://code/examples/hash": `// Hash Functions in Compact
// Examples of using hash functions for various purposes

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

export ledger commitments: Set<Bytes<32>>;
export ledger hashedData: Map<Field, Bytes<32>>;

// Basic hash function usage
witness simpleHash(data: Field): Bytes<32>;

// Create a commitment (hash of value + randomness)
witness createCommitment(value: Field, randomness: Field): Bytes<32>;

// Verify a commitment matches
export circuit verifyCommitment(
  value: Field,
  randomness: Field,
  expectedCommitment: Bytes<32>
): Boolean {
  const computed = createCommitment(value, randomness);
  assert(computed == expectedCommitment, "Commitment mismatch");
  return true;
}

// Store a hashed value
export circuit storeHashed(id: Field, data: Field): Bytes<32> {
  const hashed = simpleHash(data);
  hashedData.insert(id, hashed);
  return hashed;
}

// Commit-reveal pattern
export circuit commit(commitment: Bytes<32>): Boolean {
  assert(!commitments.member(commitment), "Already committed");
  commitments.insert(commitment);
  return true;
}

export circuit reveal(value: Field, randomness: Field): Field {
  const commitment = createCommitment(value, randomness);
  assert(commitments.member(commitment), "No matching commitment");
  return disclose(value);
}
`,

  "midnight://code/examples/simple-counter": `// Simple Counter Contract
// Minimal example for learning Compact basics

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

// Ledger state - stored on chain
export ledger counter: Counter;

// Increment the counter by 1
export circuit increment(): Uint<64> {
  counter.increment(1);
  return counter.read();
}

// Decrement the counter by 1  
export circuit decrement(): Uint<64> {
  assert(counter.read() > 0, "Cannot go below zero");
  counter.decrement(1);
  return counter.read();
}

// Get current value
export circuit get(): Uint<64> {
  return counter.read();
}

// Check if below threshold
export circuit isBelowLimit(limit: Uint<64>): Boolean {
  return counter.lessThan(limit);
}

// Reset to zero
export circuit reset(): [] {
  counter.resetToDefault();
}
`,

  "midnight://code/templates/basic": `// Basic Compact Contract Template
// Starting point for new contracts

pragma language_version >= 0.16 && <= 0.23;

import CompactStandardLibrary;

// ============================================
// LEDGER STATE
// ============================================

// Public state (visible on-chain)
export ledger initialized: Boolean;
export ledger owner: Opaque<"address">;

// Private state (only owner can see)
ledger secretData: Field;

// ============================================
// WITNESSES
// ============================================

witness getCaller(): Opaque<"address">;
witness getSecret(): Field;

// ============================================
// INITIALIZATION
// ============================================

export circuit initialize(ownerAddress: Opaque<"address">): Boolean {
  assert(!initialized, "Already initialized");
  
  owner = ownerAddress;
  initialized = true;
  
  return true;
}

// ============================================
// PUBLIC FUNCTIONS
// ============================================

export circuit publicFunction(input: Field): Field {
  assert(initialized, "Not initialized");
  
  // Your logic here
  return input * 2;
}

// ============================================
// OWNER-ONLY FUNCTIONS
// ============================================

export circuit setSecret(newSecret: Field): [] {
  const caller = getCaller();
  assert(caller == owner, "Only owner can set secret");
  secretData = newSecret;
}

// ============================================
// PRIVATE DATA ACCESS
// ============================================

export circuit revealSecret(): Field {
  const caller = getCaller();
  assert(caller == owner, "Only owner can reveal");
  return disclose(getSecret());
}
`,
};
