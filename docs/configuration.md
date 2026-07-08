# Configuration

`quality-report.yml` defines project metadata, artifact globs, requirement
matching, and quality gates.

```yaml
project:
  name: JIRA Tool
  repository: acds-at/JIRA-tool

artifacts:
  tests:
    backend:
      junit: "quality-artifacts/tests/backend/junit/**/*.xml"
    frontend:
      junit: "quality-artifacts/tests/frontend/junit/**/*.xml"
      vitestJson: "quality-artifacts/tests/frontend/vitest/**/*.json"
    e2e:
      playwrightJson: "quality-artifacts/tests/e2e/playwright/**/*.json"
  coverage:
    backend:
      jacocoXml: "quality-artifacts/coverage/backend/jacoco.xml"
    frontend:
      lcov: "quality-artifacts/coverage/frontend/lcov.info"
      summaryJson: "quality-artifacts/coverage/frontend/coverage-summary.json"
  requirements:
    expectedKeys: "quality-artifacts/requirements/expected.csv"
    mapping: "quality-artifacts/requirements/mapping.json"
  security:
    codeqlSarif: "quality-artifacts/security/codeql/**/*.sarif"
    zapJson: "quality-artifacts/security/zap/**/*.json"

requirements:
  keyPattern: "[A-Z]+-[0-9]+"
```

Globs are resolved relative to `--input`. Config validation fails for malformed
YAML or invalid schema values.
