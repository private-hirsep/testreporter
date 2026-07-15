# Configuration

`quality-report.yml` defines project metadata, artifact globs, requirement matching, quality gates, and optional custom profiles.

Globs are resolved relative to `--input` or the reusable workflow's `artifact-path`.

```yaml
project:
  name: Example Service
  repository: your-org/example-service

artifacts:
  tests:
    mapping: "tests/test-mapping.json"
    backend:
      junit: "tests/backend/junit/**/*.xml"
      pytestJunit: "tests/backend/pytest/**/*.xml"
    frontend:
      junit: "tests/frontend/junit/**/*.xml"
      vitestJson: "tests/frontend/vitest/**/*.json"
    e2e:
      junit: "tests/e2e/junit/**/*.xml"
      playwrightJson: "tests/e2e/playwright/**/*.json"
  coverage:
    backend:
      jacocoXml: "coverage/backend/jacoco.xml"
      jacocoCsv: "coverage/backend/jacoco.csv"
      coberturaXml: "coverage/backend/cobertura.xml"
      lcov: "coverage/backend/lcov.info"
      summaryJson: "coverage/backend/coverage-summary.json"
      html: "coverage/backend/html"
    frontend:
      jacocoXml: "coverage/frontend/jacoco.xml"
      coberturaXml: "coverage/frontend/cobertura.xml"
      lcov: "coverage/frontend/lcov.info"
      summaryJson: "coverage/frontend/coverage-summary.json"
      html: "coverage/frontend/html"
  requirements:
    expectedKeys: "requirements/expected.csv"
    mapping: "requirements/mapping.json"
  security:
    codeqlSarif: "security/codeql/**/*.sarif"
    zapJson: "security/zap/**/*.json"
  raw:
    - "tests/**/raw/**"

requirements:
  keyPattern: "[A-Z]+-[0-9]+"

identity:
  annotationAliases: [testCase, test-case, testCaseId, case]
  idPattern: "[A-Z][A-Z0-9_-]*-TC-[0-9]+"
  titleTokenPattern: "\\[([A-Z][A-Z0-9_-]*-TC-[0-9]+)\\]"

defects:
  keyPattern: "(?:BUG|DEFECT)-[0-9]+"

links:
  requirement: { baseUrl: "https://example.atlassian.net/browse/" }
  defect: { baseUrl: "https://example.atlassian.net/browse/" }

qualityGates:
  tests:
    allowFailed: 0
    allowBroken: 0
  coverage:
    totalMinimum: 70
  requirements:
    minimum: 75
    failOnMissing: false
    failOnExtra: false
  security:
    maxCritical: 0
    maxHigh: 0
    maxMedium: 3
  warnings:
    maxWarnings: 10
```

`quality-gates.yml` may contain `qualityGates` and `qualityGateProfiles`. Passing `--quality-profile <name>` replaces `qualityGates` with the selected built-in or custom profile. Passing `--quality-gates <path>` loads an external gates file before selecting the profile.

Current CLI custom profiles are direct profile objects; `extends` is not implemented in the canonical workflow path.
