---
"midnight-mcp": patch
---

Fix `midnight-health-check` and `midnight-check-version` failing with "Failed to call tool" in MCP clients. Both tools returned values that violated their declared `outputSchema`, so clients rejected the calls during structured-output validation:

- `midnight-health-check` returned `rateLimit` as a formatted string while the schema declares an object; it now returns the structured rate-limit object.
- `midnight-check-version` returned `null` for `updateInstructions`/`newFeatures` when already on the latest version, while the schema declares an object/array; those fields are now omitted when up to date.

Also fixes the `npm start` script, which passed an unsupported `--stdio` flag (stdio is the default transport). Adds a regression test asserting health-tool outputs conform to their schemas.
