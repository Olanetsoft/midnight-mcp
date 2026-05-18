/**
 * Compact Language Version Configuration
 *
 * MAINTAINER: Update these values when Compact language syntax changes!
 * See docs/SYNTAX_MAINTENANCE.md for the full update checklist.
 *
 * ⚠️ ARCHITECTURAL NOTE: This file contains STATIC/HARDCODED syntax information.
 * The MCP indexes 102+ repos including midnight-docs, but this file doesn't
 * automatically validate against those indexed docs.
 *
 * TODO: Add validation that cross-references this static content against
 * indexed documentation to catch outdated information. Options:
 * 1. Pre-publish script that searches docs for ADT methods and validates
 * 2. Runtime validation on first syntax tool call
 * 3. CI test that compares LEDGER_TYPE_LIMITS against indexed docs
 *
 * Source of truth for ADT operations:
 * https://docs.midnight.network/develop/reference/compact/ledger-adt
 */

/**
 * Supported Compact language version range
 * Update when new compiler versions are released
 */
export const COMPACT_VERSION = {
  /** Minimum supported version */
  min: "0.16",
  /** Maximum supported version */
  max: "0.23",
  /** When this config was last updated */
  lastUpdated: "2026-05-18",
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
  /** Deprecated in: 0.30 (compactc 0.30.0, language 0.22) */
  nativePoint: {
    pattern: /\bNativePoint\b/,
    since: "0.22",
    replacement: "JubjubPoint",
    description:
      "NativePoint type and related circuits (nativePointX, nativePointY, constructNativePoint) were renamed to JubjubPoint / jubjubPointX / jubjubPointY / constructJubjubPoint",
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
 *
 * NOTE: The exact generic signatures (e.g., persistentHash<T>) are inferred from
 * usage patterns in docs/examples. The stdlib overview confirms these functions
 * exist but doesn't provide full type signatures.
 * See: https://docs.midnight.network/develop/reference/compact/compact-std-library
 */
export const BUILTIN_FUNCTIONS = {
  /** Actually built into the language/stdlib */
  stdlib: [
    {
      name: "persistentHash",
      signature: "persistentHash<T>(value: T): Bytes<32>", // Signature inferred from examples
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
 *
 * SOURCE NOTES:
 * - Comparisons: Standard operators (==, !=, <, <=, >, >=) are used in examples
 *   but the exact operator set is not explicitly documented in the language reference.
 * - Arithmetic: Only +, -, * are documented. Division (/) is NOT mentioned.
 *   See: https://docs.midnight.network/develop/reference/compact/lang-ref#binary-arithmetic-expressions
 */
export const TYPE_COMPATIBILITY = {
  // Note: Comparison operators work in practice but aren't explicitly listed in docs
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
    {
      types: "Bytes<32> == Bytes<32>",
      works: true,
      note: "Used in examples, but operators not explicitly listed in docs",
    },
    { types: "Boolean == Boolean", works: true, note: "Direct comparison" },
  ],
  arithmetic: [
    { types: "Field + Field", works: true, note: "Field arithmetic" },
    { types: "Field + Uint<N>", works: false, fix: "Cast Uint to Field first" },
    {
      types: "Uint<N> + Uint<N>",
      works: true,
      note: "Result is bounded type, cast back: (a + b) as Uint<64>",
    },
    {
      types: "Uint<64> + Uint<64>",
      works: true,
      note: "Result is Uint<0..36893488147419103230>, must cast: (a + b) as Uint<64>",
    },
    {
      types: "Uint<64> * Uint<64>",
      works: true,
      note: "Result is wide bounded type, cast back to target type",
    },
  ],
  /**
   * Type casting rules - based on official cast table
   * See: https://docs.midnight.network/develop/reference/compact/lang-ref#type-cast-expressions
   *
   * Cast kinds: static (always succeeds), conversion (semantic change), checked (can fail)
   */
  typeCasting: [
    {
      from: "Uint<N>",
      to: "Field",
      direct: true,
      kind: "static",
      note: "Always succeeds",
    },
    {
      from: "Field",
      to: "Uint<0..n>",
      direct: true,
      kind: "checked",
      note: "Fails at runtime if value > n",
    },
    {
      from: "Field",
      to: "Bytes<n>",
      direct: true,
      kind: "conversion",
      note: "Can fail at runtime if value doesn't fit (little-endian)",
    },
    {
      from: "Bytes<m>",
      to: "Field",
      direct: true,
      kind: "conversion",
      note: "Can fail at runtime if result exceeds max Field value",
    },
    {
      from: "Boolean",
      to: "Uint<0..n>",
      direct: true,
      kind: "conversion",
      note: "false→0, true→1 (n must not be 0)",
    },
    {
      from: "Boolean",
      to: "Field",
      direct: false,
      fix: "Go through Uint: (flag as Uint<0..1>) as Field",
    },
    {
      from: "Uint<N>",
      to: "Bytes<M>",
      direct: false,
      fix: "Go through Field: (amount as Field) as Bytes<32>",
    },
    {
      from: "enum",
      to: "Field",
      direct: true,
      kind: "conversion",
      note: "Enum variant index as Field",
    },
    {
      from: "Uint<0..m>",
      to: "Uint<0..n>",
      direct: true,
      kind: "static if m≤n, checked if m>n",
      note: "Widening is static, narrowing is checked",
    },
    {
      from: "arithmetic result",
      to: "Uint<64>",
      direct: true,
      kind: "checked",
      note: "Required cast: (a + b) as Uint<64>",
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
 * Type definition for ADT operation info
 */
export interface LedgerADTOperations {
  circuitOperations: Array<{
    method: string;
    works: boolean;
    note: string;
  }>;
  typescriptAccess: string;
  note?: string;
  pattern?: string;
  reason?: string;
}

/**
 * Ledger type limitations - what works in circuits vs TypeScript
 */
export const LEDGER_TYPE_LIMITS: Record<string, LedgerADTOperations> = {
  Counter: {
    circuitOperations: [
      {
        method: ".increment(n)",
        works: true,
        note: "Increase counter by n (Uint<16>)",
      },
      {
        method: ".decrement(n)",
        works: true,
        note: "Decrease counter by n (Uint<16>)",
      },
      {
        method: ".read()",
        works: true,
        note: "Get current value (returns Uint<64>)",
      },
      {
        method: ".lessThan(n)",
        works: true,
        note: "Compare with threshold (returns Boolean)",
      },
      { method: ".resetToDefault()", works: true, note: "Reset to 0" },
    ],
    typescriptAccess:
      "Access counter value via `ledgerState.counter` in TypeScript SDK",
    note: "All Counter operations work in circuits. Use .read() to get value, NOT .value()",
  },
  Map: {
    circuitOperations: [
      {
        method: ".insert(key, value)",
        works: true,
        note: "Adds/updates entry",
      },
      {
        method: ".insertDefault(key)",
        works: true,
        note: "Inserts default value for key",
      },
      { method: ".remove(key)", works: true, note: "Removes entry" },
      {
        method: ".lookup(key)",
        works: true,
        note: "Returns value_type - gets value for key",
      },
      {
        method: ".member(key)",
        works: true,
        note: "Returns Boolean - checks if key exists",
      },
      {
        method: ".isEmpty()",
        works: true,
        note: "Returns Boolean - checks if map is empty",
      },
      {
        method: ".size()",
        works: true,
        note: "Returns Uint<64> - number of entries",
      },
      {
        method: ".resetToDefault()",
        works: true,
        note: "Clears entire map",
      },
    ],
    typescriptAccess:
      "Query map via `contractState.data.get(key)` or iterate with `[Symbol.iterator]()` in TypeScript SDK",
    note: "All Map operations work in circuits. insertCoin() available when value_type is QualifiedCoinInfo.",
  },
  Set: {
    circuitOperations: [
      { method: ".insert(value)", works: true, note: "Adds to set" },
      { method: ".remove(value)", works: true, note: "Removes from set" },
      {
        method: ".member(value)",
        works: true,
        note: "Returns Boolean - checks if value exists in set",
      },
      {
        method: ".isEmpty()",
        works: true,
        note: "Returns Boolean - checks if set is empty",
      },
      {
        method: ".size()",
        works: true,
        note: "Returns Uint<64> - number of elements",
      },
      {
        method: ".resetToDefault()",
        works: true,
        note: "Clears entire set",
      },
    ],
    typescriptAccess:
      "Check membership via `contractState.set.has(value)` or iterate with `[Symbol.iterator]()` in TypeScript SDK",
    note: "All Set operations work in circuits. insertCoin() available when value_type is QualifiedCoinInfo.",
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
    cause: "Using wrong method name - Counter uses .read() not .value()",
    fix: `Use counter.read() to get the current value:
const current = ledger.counter.read();

Counter ADT methods available in circuits:
- increment(amount: Uint<16>): []  - increase counter
- decrement(amount: Uint<16>): []  - decrease counter
- read(): Uint<64>                 - get current value
- lessThan(threshold: Uint<64>): Boolean - compare
- resetToDefault(): []             - reset to zero`,
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
    cause: "Trying to access a field on a non-struct type",
    fix: `Make sure you're accessing a struct field, not a primitive.
Map.lookup() and Map.member() ARE available in circuits.
Check that the base type is actually a struct.`,
  },
  {
    error: "potential witness-value disclosure must be declared",
    cause: "Circuit parameter flows to ledger operation without disclose()",
    fix: `Disclose parameters at the start of the circuit:
export circuit my_circuit(param: Bytes<32>): [] {
  const d_param = disclose(param);  // Acknowledge on-chain visibility
  ledger.insert(d_param, value);    // Now use disclosed value
}`,
  },
  {
    error:
      "expected second argument of insert to have type Uint<64> but received Uint<0..N>",
    cause: "Arithmetic result has bounded type, needs cast back to target",
    fix: `Cast arithmetic results back to the target type:
const new_balance = (current + amount) as Uint<64>;
ledger_map.insert(key, new_balance);`,
  },
  {
    error: "cannot cast from type Uint<64> to type Bytes<32>",
    cause: "Direct Uint to Bytes cast not allowed",
    fix: `Go through Field first:
const amount_field = amount as Field;
const amount_bytes = amount_field as Bytes<32>;
// Or chained: (amount as Field) as Bytes<32>`,
  },
  {
    error: "cannot prove assertion",
    cause: "Assert condition cannot be proven true",
    fix: `Check your logic. Common causes:
1. Witness returns unexpected value
2. Range check fails (use bounded Uint)
3. Logic error in circuit`,
  },
  {
    error: 'parse error: found ":" looking for ")"',
    cause: "Using Rust-style :: for enum variant access",
    fix: `Use dot notation for enum variants:
WRONG:  Choice::rock, GameState::waiting
CORRECT: Choice.rock, GameState.waiting`,
  },
  {
    error: 'parse error: found "{" after witness declaration',
    cause: "Trying to add implementation body to witness",
    fix: `Witnesses are declarations only - no body allowed:
WRONG:  witness get_caller(): Bytes<32> { return ...; }
CORRECT: witness get_caller(): Bytes<32>;
Implementation goes in TypeScript prover, not Compact.`,
  },
  {
    error: 'unbound identifier "function"',
    cause: 'Using "pure function" instead of "pure circuit"',
    fix: `Use "pure circuit" for helper functions:
WRONG:  pure function helper(...): Type { }
CORRECT: pure circuit helper(...): Type { }`,
  },
  {
    error:
      "apparent use of an old standard-library / ledger operator name NativePoint: the new name is JubjubPoint",
    cause:
      "Using the pre-0.22 NativePoint name. Renamed in compactc 0.30.0 (language 0.22).",
    fix: `Rename to JubjubPoint and related circuits:
WRONG:  NativePoint, nativePointX(p), nativePointY(p), constructNativePoint(x, y)
CORRECT: JubjubPoint, jubjubPointX(p), jubjubPointY(p), constructJubjubPoint(x, y)
NativePoint is rejected at compile time, not silently aliased.`,
  },
  {
    error:
      'parse error: found keyword "let" (which is reserved for future use)',
    cause:
      "Using `let` as an identifier. `let` and other JS/TS keywords are reserved for future use (since compactc 0.28.0).",
    fix: `Rename the identifier:
WRONG:  const let = 1;  // or circuit fn(let: Field): []
CORRECT: const value = 1;  // or circuit fn(value: Field): []
Other reserved words from JS/TS are also disallowed as identifiers.`,
  },
  {
    error:
      'parse error: found keyword "const" looking for a program element or end of file',
    cause:
      "Declaring `const` at module (top-of-file) scope. `const` is only allowed inside circuit/constructor bodies — there is no module-level constant in Compact.",
    fix: `Move the constant inside a circuit, or use a pure circuit returning the value:
WRONG:  const MAX_SUPPLY: Uint<64> = 1000;  // at top of file
CORRECT: pure circuit max_supply(): Uint<64> { return 1000; }
Then call max_supply() wherever you need the value.`,
  },
  {
    error: "unexpected character",
    cause:
      "Using a single `|` (bitwise OR) in an expression. Compact has no bitwise operators on Uint — only `||` (logical OR) is recognized.",
    fix: `Compact does not support bitwise OR/AND/XOR/shifts. Replace with arithmetic or branching:
WRONG:  flags | mask
CORRECT: flags + mask  // if you know bits don't overlap
   or:  if (cond) { ... } else { ... }
Use \`||\` only for Boolean values, not Uints.`,
  },
  {
    error:
      "Uint width 254 is not between 1 and the maximum Uint width 248 (inclusive)",
    cause:
      "Declaring a Uint wider than 248 bits. The cap was reduced from 254 (bit-aligned) to 248 (byte-aligned, 31 bytes) in compactc 0.27.0 to match the ledger storage alignment.",
    fix: `Use Uint<N> where 1 ≤ N ≤ 248:
WRONG:  field: Uint<254>
CORRECT: field: Uint<248>  // 31 bytes — max representable
For larger values, use Field (unbounded) and cast where needed.`,
  },
  {
    // Not a compiler error — surfaces as a TypeScript type error in generated bindings.
    error:
      "Argument of type 'number' is not assignable to parameter of type 'bigint' (convertBytesToUint)",
    cause:
      "Passing a JavaScript `number` to convertBytesToUint's `maxval` parameter. Changed to `bigint` in compactc 0.30.101 (language 0.22) to avoid silent precision loss for large Uints.",
    fix: `Pass a bigint literal for maxval:
WRONG:  convertBytesToUint(255, n, bytes, src)
CORRECT: convertBytesToUint(255n, n, bytes, src)
This is in generated TypeScript bindings — usually you don't call it directly, but if you do, the suffix-n bigint literal is required.`,
  },
];
