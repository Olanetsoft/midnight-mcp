/**
 * Embedded code examples and templates
 * Separated from code.ts for better maintainability
 */

export const EMBEDDED_CODE: Record<string, string> = {
  "midnight://code/examples/counter": `// Counter Example Contract
// A simple contract demonstrating basic Compact concepts

include "std";

ledger {
  // Public counter - visible to everyone
  counter: Counter;
  
  // Track last modifier (public)
  lastModifier: Opaque<"address">;
}

// Increment the counter
export circuit increment(amount: Field): Field {
  // Validate input
  assert(amount > 0, "Amount must be positive");
  assert(amount <= 100, "Amount too large");
  
  // Update counter
  ledger.counter.increment(amount);
  
  // Return new value
  return ledger.counter.value();
}

// Decrement the counter
export circuit decrement(amount: Field): Field {
  // Validate input
  assert(amount > 0, "Amount must be positive");
  assert(ledger.counter.value() >= amount, "Counter would go negative");
  
  // Update counter
  ledger.counter.decrement(amount);
  
  // Return new value
  return ledger.counter.value();
}

// Read current value (view function)
export circuit getValue(): Field {
  return ledger.counter.value();
}
`,

  "midnight://code/examples/bboard": `// Bulletin Board Example Contract
// Demonstrates private messaging with selective disclosure

include "std";

ledger {
  // Public: message count and IDs
  messageCount: Counter;
  messageIds: Set<Field>;
  
  // Private: actual message contents
  @private
  messages: Map<Field, Opaque<"string">>;
  
  // Private: message authors
  @private
  authors: Map<Field, Opaque<"address">>;
}

// Post a new message (content is private)
export circuit postMessage(content: Opaque<"string">, author: Opaque<"address">): Field {
  // Generate unique message ID
  const messageId = ledger.messageCount.value();
  
  // Store message privately
  ledger.messages.insert(messageId, content);
  ledger.authors.insert(messageId, author);
  
  // Update public counters
  ledger.messageCount.increment(1);
  ledger.messageIds.add(messageId);
  
  return messageId;
}

// Witness to fetch message content
witness getMessageContent(id: Field): Opaque<"string"> {
  return ledger.messages.get(id);
}

// Reveal a message publicly (owner's choice)
export circuit revealMessage(id: Field): Opaque<"string"> {
  assert(ledger.messageIds.contains(id), "Message not found");
  
  const content = getMessageContent(id);
  return disclose(content);
}

// Get total message count
export circuit getMessageCount(): Field {
  return ledger.messageCount.value();
}
`,

  "midnight://code/patterns/state-management": `// State Management Pattern
// Best practices for managing public and private state

include "std";

ledger {
  // PUBLIC STATE
  // - Use for data that should be transparent
  // - Visible in blockchain explorers
  // - Can be queried by anyone
  
  totalSupply: Counter;
  publicConfig: Field;
  
  // PRIVATE STATE
  // - Use for sensitive user data
  // - Only owner can read
  // - Requires witnesses to access in circuits
  
  @private
  userSecrets: Map<Opaque<"address">, Bytes<32>>;
  
  @private
  privateBalances: Map<Opaque<"address">, Field>;
}

// Reading public state is straightforward
export circuit getTotalSupply(): Field {
  return ledger.totalSupply.value();
}

// Reading private state requires a witness
witness getUserSecret(user: Opaque<"address">): Bytes<32> {
  return ledger.userSecrets.get(user);
}

// Using private state in a circuit
export circuit proveSecretKnowledge(
  user: Opaque<"address">,
  secretHash: Bytes<32>
): Boolean {
  const secret = getUserSecret(user);
  
  // Prove knowledge without revealing secret
  assert(hash(secret) == secretHash);
  return true;
}

// Selective disclosure pattern
export circuit revealBalance(user: Opaque<"address">): Field {
  const balance = getPrivateBalance(user);
  // Explicitly reveal - user's choice
  return disclose(balance);
}

witness getPrivateBalance(user: Opaque<"address">): Field {
  return ledger.privateBalances.get(user);
}
`,

  "midnight://code/patterns/access-control": `// Access Control Pattern
// Implementing permissions and authorization

include "std";

ledger {
  // Role definitions
  owner: Opaque<"address">;
  admins: Set<Opaque<"address">>;
  
  // Access-controlled state
  sensitiveData: Field;
  
  @private
  adminKeys: Map<Opaque<"address">, Bytes<32>>;
}

// Witness to get caller identity
witness getCaller(): Opaque<"address"> {
  return getCurrentCaller();
}

// Only owner can call
export circuit onlyOwnerAction(newValue: Field): Void {
  const caller = getCaller();
  assert(caller == ledger.owner, "Not owner");
  
  ledger.sensitiveData = newValue;
}

// Only admins can call
export circuit onlyAdminAction(data: Field): Void {
  const caller = getCaller();
  assert(ledger.admins.contains(caller), "Not admin");
  
  // Admin action here
}

// Multi-sig pattern (require multiple approvals)
witness getApprovalCount(action: Bytes<32>): Field {
  return countApprovals(action);
}

export circuit requireMultisig(action: Bytes<32>, threshold: Field): Boolean {
  const approvals = getApprovalCount(action);
  assert(approvals >= threshold, "Insufficient approvals");
  return true;
}

// Time-locked action
witness getCurrentTime(): Field {
  return getBlockTimestamp();
}

export circuit timeLockedAction(unlockTime: Field): Void {
  const currentTime = getCurrentTime();
  assert(currentTime >= unlockTime, "Action is timelocked");
  
  // Perform action
}
`,

  "midnight://code/patterns/privacy-preserving": `// Privacy-Preserving Patterns
// Techniques for maintaining privacy in smart contracts

include "std";

ledger {
  // Commitment-based private balance
  balanceCommitments: Map<Opaque<"address">, Field>;
  
  // Nullifier set (prevents double-spending)
  nullifiers: Set<Field>;
  
  @private
  secretBalances: Map<Opaque<"address">, Field>;
  
  @private
  secretNonces: Map<Opaque<"address">, Field>;
}

// PATTERN 1: Commitment Scheme
// Store commitments instead of values

export circuit deposit(
  user: Opaque<"address">,
  amount: Field,
  nonce: Field
): Field {
  // Create commitment: hash(amount, nonce, user)
  const commitment = hash(amount, nonce, user);
  
  // Store commitment (hides amount)
  ledger.balanceCommitments.insert(user, commitment);
  
  return commitment;
}

export circuit proveBalance(
  user: Opaque<"address">,
  amount: Field,
  nonce: Field,
  minBalance: Field
): Boolean {
  // Verify commitment
  const expectedCommitment = hash(amount, nonce, user);
  assert(ledger.balanceCommitments.get(user) == expectedCommitment);
  
  // Prove property without revealing value
  assert(amount >= minBalance);
  return true;
}

// PATTERN 2: Nullifiers (Prevent Double-Spending)

witness generateNullifier(secret: Bytes<32>, action: Field): Field {
  return hash(secret, action);
}

export circuit spendOnce(
  secret: Bytes<32>,
  action: Field
): Void {
  const nullifier = generateNullifier(secret, action);
  
  // Check nullifier hasn't been used
  assert(!ledger.nullifiers.contains(nullifier), "Already spent");
  
  // Mark as used
  ledger.nullifiers.add(nullifier);
  
  // Perform action
}

// PATTERN 3: Range Proofs

export circuit proveInRange(
  @private value: Field,
  min: Field,
  max: Field
): Boolean {
  // Prove value is in range without revealing it
  assert(value >= min);
  assert(value <= max);
  return true;
}

// PATTERN 4: Private Set Membership

export circuit proveMembership(
  @private element: Field,
  setRoot: Field,
  @private proof: Array<Field>
): Boolean {
  // Prove element is in set without revealing which element
  const computedRoot = computeMerkleRoot(element, proof);
  assert(computedRoot == setRoot);
  return true;
}

witness computeMerkleRoot(element: Field, proof: Array<Field>): Field {
  // Compute Merkle root from element and proof
  return merkleCompute(element, proof);
}
`,

  "midnight://code/templates/token": `// Privacy-Preserving Token Template
// Starter template for token contracts with privacy features

include "std";

ledger {
  // Public token metadata
  name: Opaque<"string">;
  symbol: Opaque<"string">;
  decimals: Field;
  totalSupply: Counter;
  
  // Private balances
  @private
  balances: Map<Opaque<"address">, Field>;
  
  // Private allowances
  @private
  allowances: Map<Opaque<"address">, Map<Opaque<"address">, Field>>;
}

// Witnesses for private state access
witness getBalance(account: Opaque<"address">): Field {
  return ledger.balances.get(account) ?? 0;
}

witness getAllowance(owner: Opaque<"address">, spender: Opaque<"address">): Field {
  return ledger.allowances.get(owner)?.get(spender) ?? 0;
}

witness getCaller(): Opaque<"address"> {
  return getCurrentCaller();
}

// Transfer tokens privately
export circuit transfer(
  to: Opaque<"address">,
  amount: Field
): Boolean {
  const from = getCaller();
  const fromBalance = getBalance(from);
  
  // Validate
  assert(amount > 0, "Invalid amount");
  assert(fromBalance >= amount, "Insufficient balance");
  
  // Update balances privately
  ledger.balances.insert(from, fromBalance - amount);
  ledger.balances.insert(to, getBalance(to) + amount);
  
  return true;
}

// Approve spender
export circuit approve(
  spender: Opaque<"address">,
  amount: Field
): Boolean {
  const owner = getCaller();
  
  // Get or create allowance map for owner
  // Note: Simplified - actual implementation needs nested map handling
  ledger.allowances.get(owner).insert(spender, amount);
  
  return true;
}

// Transfer from approved account
export circuit transferFrom(
  from: Opaque<"address">,
  to: Opaque<"address">,
  amount: Field
): Boolean {
  const spender = getCaller();
  const allowance = getAllowance(from, spender);
  const fromBalance = getBalance(from);
  
  // Validate
  assert(amount > 0, "Invalid amount");
  assert(allowance >= amount, "Insufficient allowance");
  assert(fromBalance >= amount, "Insufficient balance");
  
  // Update state
  ledger.balances.insert(from, fromBalance - amount);
  ledger.balances.insert(to, getBalance(to) + amount);
  ledger.allowances.get(from).insert(spender, allowance - amount);
  
  return true;
}

// Reveal balance (user's choice)
export circuit revealMyBalance(): Field {
  const caller = getCaller();
  const balance = getBalance(caller);
  return disclose(balance);
}
`,

  "midnight://code/templates/voting": `// Private Voting Template
// Starter template for privacy-preserving voting contracts

include "std";

ledger {
  // Public: proposal metadata
  proposalCount: Counter;
  proposals: Map<Field, Opaque<"string">>;
  votingDeadlines: Map<Field, Field>;
  
  // Public: vote tallies (revealed after voting ends)
  finalTallies: Map<Field, Map<Field, Field>>; // proposalId -> optionId -> count
  
  // Private: individual votes
  @private
  votes: Map<Field, Map<Opaque<"address">, Field>>; // proposalId -> voter -> option
  
  // Nullifiers to prevent double voting
  voteNullifiers: Set<Field>;
  
  // Eligible voters
  eligibleVoters: Set<Opaque<"address">>;
}

// Witnesses
witness getCaller(): Opaque<"address"> {
  return getCurrentCaller();
}

witness getCurrentTime(): Field {
  return getBlockTimestamp();
}

witness getVote(proposalId: Field, voter: Opaque<"address">): Field {
  return ledger.votes.get(proposalId)?.get(voter) ?? 0;
}

witness computeNullifier(voter: Opaque<"address">, proposalId: Field): Field {
  return hash(voter, proposalId);
}

// Create a new proposal
export circuit createProposal(
  description: Opaque<"string">,
  deadline: Field,
  options: Field
): Field {
  const proposalId = ledger.proposalCount.value();
  
  // Store proposal
  ledger.proposals.insert(proposalId, description);
  ledger.votingDeadlines.insert(proposalId, deadline);
  
  // Initialize tally for each option
  // (Simplified - actual implementation needs loop)
  
  ledger.proposalCount.increment(1);
  return proposalId;
}

// Cast a private vote
export circuit vote(
  proposalId: Field,
  option: Field
): Boolean {
  const voter = getCaller();
  const currentTime = getCurrentTime();
  
  // Check eligibility
  assert(ledger.eligibleVoters.contains(voter), "Not eligible to vote");
  
  // Check deadline
  const deadline = ledger.votingDeadlines.get(proposalId);
  assert(currentTime < deadline, "Voting ended");
  
  // Check for double voting using nullifier
  const nullifier = computeNullifier(voter, proposalId);
  assert(!ledger.voteNullifiers.contains(nullifier), "Already voted");
  
  // Record vote privately
  ledger.votes.get(proposalId).insert(voter, option);
  
  // Add nullifier to prevent double voting
  ledger.voteNullifiers.add(nullifier);
  
  return true;
}

// Reveal individual vote (voter's choice)
export circuit revealMyVote(proposalId: Field): Field {
  const voter = getCaller();
  const myVote = getVote(proposalId, voter);
  return disclose(myVote);
}

// Tally votes (after deadline)
// Note: This is simplified - real implementation would need
// a mechanism to privately aggregate votes
export circuit tallyVotes(proposalId: Field): Boolean {
  const currentTime = getCurrentTime();
  const deadline = ledger.votingDeadlines.get(proposalId);
  
  assert(currentTime >= deadline, "Voting still active");
  
  // In a real implementation, votes would be aggregated
  // using homomorphic encryption or MPC
  
  return true;
}

// Add eligible voter (admin only)
export circuit addVoter(voter: Opaque<"address">): Void {
  // Add access control in real implementation
  ledger.eligibleVoters.add(voter);
}
`,

  "midnight://code/examples/nullifier": `// Nullifier Pattern Example
// Demonstrates how to create and use nullifiers to prevent double-spending/actions

include "std";

ledger {
  // Set of used nullifiers - prevents replay attacks
  usedNullifiers: Set<Bytes<32>>;
  
  // Track claimed rewards
  claimedRewards: Counter;
}

// Hash function for creating nullifiers
// Combines secret + public data to create unique identifier
witness computeNullifier(secret: Field, commitment: Field): Bytes<32> {
  // Hash the secret with the commitment
  // The nullifier reveals nothing about the secret
  // but is unique per secret+commitment pair
  return hash(secret, commitment);
}

// Alternative: nullifier from address and action ID
witness computeActionNullifier(
  userSecret: Field, 
  actionId: Field
): Bytes<32> {
  // Create nullifier: hash(secret || actionId)
  return hash(userSecret, actionId);
}

// Claim a reward (can only claim once per user)
export circuit claimReward(
  secret: Field,
  commitment: Field,
  rewardAmount: Field
): Boolean {
  // Compute the nullifier
  const nullifier = computeNullifier(secret, commitment);
  
  // Check nullifier hasn't been used (prevents double-claim)
  assert(
    !ledger.usedNullifiers.contains(nullifier), 
    "Reward already claimed"
  );
  
  // Mark nullifier as used
  ledger.usedNullifiers.add(nullifier);
  
  // Process reward
  ledger.claimedRewards.increment(rewardAmount);
  
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
    !ledger.usedNullifiers.contains(nullifier),
    "Already voted on this proposal"
  );
  
  // Record nullifier
  ledger.usedNullifiers.add(nullifier);
  
  // Process vote...
  return true;
}
`,

  "midnight://code/examples/hash": `// Hash Functions in Compact
// Examples of using hash functions for various purposes

include "std";

ledger {
  commitments: Set<Bytes<32>>;
  hashedData: Map<Field, Bytes<32>>;
}

// Basic hash function usage
witness simpleHash(data: Field): Bytes<32> {
  // Hash a single field element
  return hash(data);
}

// Hash multiple values together
witness hashMultiple(a: Field, b: Field, c: Field): Bytes<32> {
  // Concatenate and hash
  return hash(a, b, c);
}

// Create a commitment (hash of value + randomness)
witness createCommitment(value: Field, randomness: Field): Bytes<32> {
  // Pedersen-style commitment: H(value || randomness)
  return hash(value, randomness);
}

// Hash bytes data
witness hashBytes(data: Bytes<64>): Bytes<32> {
  return hash(data);
}

// Create nullifier from secret
witness createNullifier(secret: Field, publicInput: Field): Bytes<32> {
  // Nullifier = H(secret || publicInput)
  // Reveals nothing about secret, but is deterministic
  return hash(secret, publicInput);
}

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
  ledger.hashedData.insert(id, hashed);
  return hashed;
}

// Commit-reveal pattern
export circuit commit(commitment: Bytes<32>): Boolean {
  assert(!ledger.commitments.contains(commitment), "Already committed");
  ledger.commitments.add(commitment);
  return true;
}

export circuit reveal(value: Field, randomness: Field): Field {
  const commitment = createCommitment(value, randomness);
  assert(ledger.commitments.contains(commitment), "No matching commitment");
  return disclose(value);
}
`,

  "midnight://code/examples/simple-counter": `// Simple Counter Contract
// Minimal example for learning Compact basics

include "std";

// Ledger state - stored on chain
ledger {
  counter: Counter;
}

// Increment the counter by 1
export circuit increment(): Field {
  ledger.counter.increment(1);
  return ledger.counter.value();
}

// Decrement the counter by 1  
export circuit decrement(): Field {
  assert(ledger.counter.value() > 0, "Cannot go below zero");
  ledger.counter.decrement(1);
  return ledger.counter.value();
}

// Get current value
export circuit get(): Field {
  return ledger.counter.value();
}

// Reset to zero (add access control in real apps)
export circuit reset(): Void {
  const current = ledger.counter.value();
  ledger.counter.decrement(current);
}
`,

  "midnight://code/templates/basic": `// Basic Compact Contract Template
// Starting point for new contracts

include "std";

// ============================================
// LEDGER STATE
// ============================================

ledger {
  // Public state (visible on-chain)
  initialized: Boolean;
  owner: Opaque<"address">;
  
  // Private state (only owner can see)
  @private
  secretData: Field;
}

// ============================================
// INITIALIZATION
// ============================================

export circuit initialize(ownerAddress: Opaque<"address">): Boolean {
  assert(!ledger.initialized, "Already initialized");
  
  ledger.owner = ownerAddress;
  ledger.initialized = true;
  
  return true;
}

// ============================================
// ACCESS CONTROL
// ============================================

witness getCaller(): Opaque<"address"> {
  // Returns the transaction sender
  return context.caller;
}

witness isOwner(): Boolean {
  return getCaller() == ledger.owner;
}

// ============================================
// PUBLIC FUNCTIONS
// ============================================

export circuit publicFunction(input: Field): Field {
  assert(ledger.initialized, "Not initialized");
  
  // Your logic here
  return input * 2;
}

// ============================================
// OWNER-ONLY FUNCTIONS
// ============================================

export circuit setSecret(newSecret: Field): Void {
  assert(isOwner(), "Only owner can set secret");
  ledger.secretData = newSecret;
}

// ============================================
// PRIVATE DATA ACCESS
// ============================================

witness getSecret(): Field {
  assert(isOwner(), "Only owner can view");
  return ledger.secretData;
}

export circuit revealSecret(): Field {
  assert(isOwner(), "Only owner can reveal");
  return disclose(getSecret());
}
`,
};
