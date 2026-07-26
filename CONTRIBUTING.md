# Contributing

Use Node 22 and install with `npm ci`. Before opening a pull request run:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
git diff --check
```

Keep changes within the static, Git-first architecture. Add tests for changed
contracts and update the relevant documentation. Pull requests must not require
write-capable credentials to generate their quality-report artifact.
