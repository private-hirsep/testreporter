# Security policy

Security fixes are supported for the latest release candidate and latest stable
minor release. Report vulnerabilities privately through GitHub Security Advisories;
do not include tokens, private reports, or customer evidence in a public issue.

Generated reports are static. Treat imported artifacts as untrusted input and grant
`contents: write`, `pages: write`, and identity-token permissions only to the
isolated trusted jobs documented in [GitHub Actions](docs/github-actions.md).
