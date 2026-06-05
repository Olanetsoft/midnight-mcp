---
"midnight-mcp": patch
---

**Security: enable DNS-rebinding protection on the HTTP transport**

When running in HTTP mode (`--http`), the Streamable HTTP and SSE transports were
created without `Origin`/`Host` validation. The MCP SDK ships this protection off by
default, which let any website the user visited use a DNS-rebinding trick to complete
the MCP handshake and invoke tools against the loopback server — reading back tool
output (e.g. local `.compact` file contents) and running up local AI usage via
sampling.

Both transports now enable `enableDnsRebindingProtection` with a port-aware loopback
allowlist (`127.0.0.1:<port>` / `localhost:<port>`), so requests carrying a foreign
`Origin` or `Host` are rejected with `403`. A matching guard is applied to the GET
`/sse` stream, which the SDK does not validate on its own. Legitimate localhost
clients and non-browser CLI clients (no `Origin` header) are unaffected.
