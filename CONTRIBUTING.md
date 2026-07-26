# Contributing

Use Node 22 and install with `npm ci`. Before opening a pull request run:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run check:workflows-docs
npm run release:smoke
git diff --check
```

Keep changes within the static, Git-first architecture. Add tests for changed
contracts and update the relevant documentation. Pull requests must not require
write-capable credentials to generate their quality-report artifact.

Release packaging produces core, adapters, and CLI tarballs in dependency order.
Keep runtime dependencies versioned—never publish `file:../` references—and keep
each package `files` allowlist limited to runtime output, declarations, README,
and license.
