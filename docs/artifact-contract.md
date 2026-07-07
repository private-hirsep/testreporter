# Artifact Contract

Recommended layout:

```text
quality-artifacts/
  tests/backend/junit/
  tests/frontend/junit/
  tests/frontend/vitest/
  tests/e2e/junit/
  tests/e2e/playwright/
  coverage/backend/jacoco.xml
  coverage/backend/html/
  coverage/frontend/lcov.info
  coverage/frontend/coverage-summary.json
  coverage/frontend/html/
  requirements/expected.csv
  requirements/mapping.json
  security/codeql/
  security/zap/
  meta/manifest.yml
```

This layout is recommended, not required. Any project may use different artifact
names or paths if `quality-report.yml` maps them explicitly.

Raw third-party HTML reports can be copied and linked as static downloads. The
main SPA does not embed arbitrary HTML.

Generated report JSON stores safe relative source labels and generated raw asset
links. It must not expose absolute local filesystem paths from the machine that
ran the generator.
