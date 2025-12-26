/**
 * Compact Language Version Configuration
 *
 * MAINTAINER: Update these values when Compact language syntax changes!
 * See docs/SYNTAX_MAINTENANCE.md for the full update checklist.
 */

/**
 * Supported Compact language version range
 * Update when new compiler versions are released
 */
export const COMPACT_VERSION = {
  /** Minimum supported version */
  min: "0.16",
  /** Maximum supported version */
  max: "0.18",
  /** When this config was last updated */
  lastUpdated: "2025-01-26",
  /** Source of truth for syntax patterns */
  referenceSource: "https://github.com/piotr-iohk/template-contract",
};

/**
 * Current pragma format that should be used in contracts
 */
export const RECOMMENDED_PRAGMA = `pragma language_version >= ${COMPACT_VERSION.min} && <= ${COMPACT_VERSION.max};`;

/**
 * Known deprecated patterns (add new ones here when Compact evolves)
 */
export const DEPRECATED_PATTERNS = {
  /** Deprecated in: 0.16 */
  ledgerBlock: {
    pattern: /ledger\s*\{/,
    since: "0.16",
    replacement: "export ledger fieldName: Type;",
    description: "Block-style ledger declarations",
  },
  /** Deprecated in: 0.15 */
  cellWrapper: {
    pattern: /Cell\s*<\s*\w+\s*>/,
    since: "0.15",
    replacement: "Type (without Cell wrapper)",
    description: "Cell<T> type wrapper",
  },
  /** Never existed */
  voidType: {
    pattern: /:\s*Void\b/,
    since: "always",
    replacement: "[] (empty tuple)",
    description: "Void return type",
  },
};

/**
 * Reference contracts known to compile successfully
 * Use these to verify syntax is still correct
 */
export const REFERENCE_CONTRACTS = [
  {
    name: "template-contract",
    repo: "piotr-iohk/template-contract",
    description: "Official Midnight template contract",
  },
  {
    name: "tokenomics-project",
    repo: "piotr-iohk/tokenomics-project",
    description: "Token implementation example",
  },
  {
    name: "zswap-example",
    repo: "piotr-iohk/zswap-example",
    description: "Privacy-preserving swap example",
  },
  {
    name: "reentrancy-example",
    repo: "piotr-iohk/reentrancy-example",
    description: "Cross-contract call patterns",
  },
];

/**
 * Get the version info as a string for display
 */
export function getVersionInfo(): string {
  return `Compact ${COMPACT_VERSION.min}-${COMPACT_VERSION.max} (updated ${COMPACT_VERSION.lastUpdated})`;
}

/**
 * Check if a version is within supported range
 */
export function isVersionSupported(version: string): boolean {
  const [major, minor] = version.split(".").map(Number);
  const [minMajor, minMinor] = COMPACT_VERSION.min.split(".").map(Number);
  const [maxMajor, maxMinor] = COMPACT_VERSION.max.split(".").map(Number);

  const versionNum = major * 100 + minor;
  const minNum = minMajor * 100 + minMinor;
  const maxNum = maxMajor * 100 + maxMinor;

  return versionNum >= minNum && versionNum <= maxNum;
}

/**
 * Built-in functions vs patterns you must implement yourself
 * CRITICAL: These are the actual stdlib functions available in Compact
 */
export const BUILTIN_FUNCTIONS = {
  /** Actually built into the language/stdlib */
  stdlib: [
    {
      name: "persistentHash",
      signature: "persistentHash<T>(value: T): Bytes<32>",
      description:
        "Poseidon hash that produces consistent results across calls",
    },
    {
      name: "persistentCommit",
      signature: "persistentCommit<T>(value: T): Bytes<32>",
      description: "Creates a hiding commitment to a value",
    },
    {
      name: "pad",
      signature: "pad(length: number, value: string): Bytes<N>",
      description: "Pads a string to fixed-length bytes",
    },
    {
      name: "disclose",
      signature: "disclose(value: T): T",
      description:
        "Explicitly reveals a witness value (required in conditionals)",
    },
    {
      name: "assert",
      signature: "assert(condition: Boolean, message?: string): []",
      description: "Fails circuit if condition is false",
    },
    {
      name: "default",
      signature: "default<T>(): T",
      description:
        "Returns default value for a type (0 for numbers, empty for collections)",
    },
  ],

  /** NOT built-in - you must implement these patterns yourself */
  notBuiltIn: [
    {
      name: "public_key",
      wrongUsage: "public_key(sk) // ERROR: unbound identifier",
      correctPattern: `// Derive public key using persistentHash
const pk = persistentHash<Vector<2, Bytes<32>>>([
  pad(32, "midnight:pk:"),
  sk
]);`,
      description:
        "Public key derivation is NOT a builtin - use persistentHash pattern",
    },
    {
      name: "verify_signature",
      wrongUsage: "verify_signature(msg, sig, pk) // Does not exist",
      correctPattern: `// Signature verification must be done via witnesses
// The prover verifies off-chain, then provides the boolean result
witness signature_valid(): Boolean;`,
      description: "Signature verification is done off-chain in the prover",
    },
    {
      name: "random",
      wrongUsage: "random() // Does not exist in ZK circuits",
      correctPattern: `// Randomness must come from witnesses (prover-provided)
witness get_random_value(): Field;`,
      description:
        "ZK circuits are deterministic - randomness must come from witnesses",
    },
  ],
};

/**
 * Type compatibility rules - what types can be compared/operated together
 */
export const TYPE_COMPATIBILITY = {
  comparisons: [
    { types: "Field == Field", works: true, note: "Direct comparison" },
    {
      types: "Field == Uint<N>",
      works: false,
      fix: "Cast with `value as Field`",
    },
    {
      types: "Field >= 0",
      works: false,
      fix: "Use bounded Uint<0..N> parameter instead",
    },
    { types: "Uint<N> == Uint<N>", works: true, note: "Same-width comparison" },
    {
      types: "Uint<0..2> == Uint<0..2>",
      works: true,
      note: "Bounded integers",
    },
    { types: "Bytes<32> == Bytes<32>", works: true, note: "Direct comparison" },
    { types: "Boolean == Boolean", works: true, note: "Direct comparison" },
  ],
  arithmetic: [
    { types: "Field + Field", works: true, note: "Field arithmetic" },
    { types: "Field + Uint<N>", works: false, fix: "Cast Uint to Field first" },
    {
      types: "Uint<N> + Uint<N>",
      works: true,
      note: "Must fit in result width",
    },
  ],
  assignments: [
    {
      types: "Field = Uint<N>",
      works: false,
      fix: "Cast with `value as Field`",
    },
    {
      types: "Uint<N> = Field",
      works: false,
      fix: "Use bounded param or explicit cast",
    },
  ],
  tips: [
    "Use Uint<0..N> for circuit parameters that need range validation",
    "Field is unbounded - use for hashes, commitments, general computation",
    "Uint<N> is bounded - use when you need range checks",
    "Casting with `as Field` is safe but loses range information",
  ],
};

/**
 * Ledger type limitations - what works in circuits vs TypeScript
 */
export const LEDGER_TYPE_LIMITS = {
  Counter: {
    circuitOperations: [
      { method: ".increment(n)", works: true, note: "Adds n to counter" },
      {
        method: ".decrement(n)",
        works: true,
        note: "Subtracts n from counter",
      },
      { method: ".resetToDefault()", works: true, note: "Resets to 0" },
      { method: ".value()", works: false, note: "NOT available in circuits" },
    ],
    typescriptAccess:
      "Access counter value via `ledgerState.counter` in TypeScript SDK",
    reason: "ZK circuits cannot read current ledger state - only modify it",
  },
  Map: {
    circuitOperations: [
      {
        method: ".insert(key, value)",
        works: true,
        note: "Adds/updates entry",
      },
      { method: ".remove(key)", works: true, note: "Removes entry" },
      {
        method: ".lookup(key)",
        works: false,
        note: "NOT available in circuits",
      },
      {
        method: ".member(key)",
        works: false,
        note: "NOT available in circuits",
      },
    ],
    typescriptAccess:
      "Query map via `contractState.data.get(key)` in TypeScript SDK",
    reason:
      "ZK circuits prove transitions, not current state. Use witnesses for reads.",
    pattern: `// To read a map value in a circuit, use a witness:
witness get_stored_value(key: Bytes<32>): Field;

export circuit update_if_exists(key: Bytes<32>, new_value: Field): [] {
  const current = get_stored_value(key);  // Prover fetches from ledger
  // ... use current value
  data.insert(key, new_value);  // Update is allowed
}`,
  },
  Set: {
    circuitOperations: [
      { method: ".insert(value)", works: true, note: "Adds to set" },
      { method: ".remove(value)", works: true, note: "Removes from set" },
      {
        method: ".member(value)",
        works: false,
        note: "NOT available in circuits",
      },
    ],
    typescriptAccess:
      "Check membership via `contractState.set.has(value)` in TypeScript SDK",
    reason: "Same as Map - use witnesses for membership checks",
  },
  MerkleTree: {
    circuitOperations: [
      { method: ".insert(leaf)", works: true, note: "Adds leaf to tree" },
      { method: ".root()", works: false, note: "NOT available in circuits" },
    ],
    typescriptAccess:
      "Get root via `contractState.tree.root` in TypeScript SDK",
    pattern: `// To verify a merkle proof in circuit:
witness get_merkle_root(): Bytes<32>;
witness get_merkle_proof(leaf: Bytes<32>): Vector<32, Bytes<32>>;

// Verify proof using persistentHash to compute expected root`,
  },
};

/**
 * Common compilation errors with their fixes
 * Maps actual compiler error messages to solutions
 */
export const COMMON_ERRORS = [
  {
    error: 'unbound identifier "public_key"',
    cause: "Trying to use public_key() as if it's a builtin function",
    fix: `Use persistentHash pattern instead:
const pk = persistentHash<Vector<2, Bytes<32>>>([pad(32, "midnight:pk:"), sk]);`,
  },
  {
    error: "incompatible combination of types Field and Uint",
    cause: "Comparing or operating on Field with Uint without casting",
    fix: `Cast Uint to Field: (myUint as Field)
Or use bounded Uint<0..N> for parameters that need constraints`,
  },
  {
    error: 'operation "value" undefined for ledger field type Counter',
    cause: "Trying to read Counter.value() inside a circuit",
    fix: `Counter values cannot be read in circuits. Options:
1. Use a witness: witness get_counter_value(): Uint<64>;
2. Read from TypeScript SDK: ledgerState.counter
3. Track the value in a separate Field ledger variable`,
  },
  {
    error: "implicit disclosure of witness value",
    cause: "Using witness value in conditional without disclose()",
    fix: `Wrap witness comparisons in disclose():
if (disclose(witness_value == expected)) { ... }`,
  },
  {
    error: 'parse error: found "{" looking for an identifier',
    cause: "Using old ledger { } block syntax",
    fix: `Use individual exports instead:
export ledger field1: Type1;
export ledger field2: Type2;`,
  },
  {
    error: 'parse error: found "{" looking for ";"',
    cause: "Using Void as return type (doesn't exist)",
    fix: `Use empty tuple [] for no return value:
export circuit myCircuit(): [] { ... }`,
  },
  {
    error: 'unbound identifier "Cell"',
    cause: "Using deprecated Cell<T> wrapper (removed in 0.15)",
    fix: `Remove Cell wrapper, just use the type directly:
export ledger myField: Field;  // Not Cell<Field>`,
  },
  {
    error: "member access requires struct type",
    cause: "Trying to use .member() or .lookup() on Map/Set in circuit",
    fix: `Map/Set queries are not available in circuits.
Use a witness to fetch the value from the prover:
witness lookup_value(key: Bytes<32>): Field;`,
  },
  {
    error: "cannot prove assertion",
    cause: "Assert condition cannot be proven true",
    fix: `Check your logic. Common causes:
1. Witness returns unexpected value
2. Range check fails (use bounded Uint)
3. Logic error in circuit`,
  },
];
