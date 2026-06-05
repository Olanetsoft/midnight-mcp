---
"midnight-mcp": patch
---

**Remove dead duplicate `src/pipeline/repository.ts`**

Removed `src/pipeline/repository.ts` — a fully orphaned 649-line duplicate of the
active `src/tools/repository/` module. It was not imported anywhere, not a build entry,
and not covered by tests, and it carried a stale, out-of-sync copy of `REPO_ALIASES`
(21 entries vs the authoritative 56). Deleting it removes the duplicate `REPO_ALIASES`,
`EXAMPLES`, and `ExampleDefinition` in one move. Typecheck, build, and the full test
suite pass unchanged, confirming it was dead.
