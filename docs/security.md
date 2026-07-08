# Security Model

The generated report is fully static. It does not require a backend, database, SSR runtime, API server, or external service.

Security rules implemented by the project:

- Artifacts are treated as untrusted parser input.
- Structured parser input is size-limited.
- Malformed inputs become parser warnings or controlled errors.
- Raw third-party HTML is copied and linked as downloadable evidence, not embedded in the SPA.
- Markdown comments escape user-controlled values.
- Known secret-like values are redacted in normalized fields where feasible.
- Absolute paths are scrubbed to relative labels or `[path]` where feasible.
- GitHub workflows support least-privilege caller permissions for comments and Pages.
- Basic generation requires no secrets.

The report data stays in the generated static site and is not sent to third-party services.
