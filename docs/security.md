# Security Model

The generated report is fully static. It does not require a backend, database,
SSR runtime, API server, or external service.

Rules:

- no `eval`
- no `new Function`
- no unsanitized HTML injection
- no embedding arbitrary third-party HTML inside the SPA
- static raw reports are copied and linked only
- parser input is size-limited
- malformed inputs become warnings or controlled errors
- known secret-like values are redacted in normalized fields where feasible
- GitHub workflows use least-privilege permissions
- basic generation requires no secrets

The report data stays in the generated site and is not sent to third-party
services.
