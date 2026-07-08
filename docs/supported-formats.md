# Supported Formats

The generator consumes files selected by `quality-report.yml`. It does not care which tool produced them.

| Area              | Config keys                                                             | Formats                                                                           |
| ----------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Backend tests     | `artifacts.tests.backend.junit`, `pytestJunit`                          | JUnit XML, including Pytest and Maven Surefire/Failsafe output                    |
| Frontend tests    | `artifacts.tests.frontend.junit`, `vitestJson`                          | JUnit XML, Vitest JSON                                                            |
| E2E tests         | `artifacts.tests.e2e.junit`, `playwrightJson`                           | JUnit XML, Playwright JSON                                                        |
| Backend coverage  | `jacocoXml`, `jacocoCsv`, `coberturaXml`, `lcov`, `summaryJson`, `html` | JaCoCo XML/CSV, Cobertura XML, LCOV, Istanbul summary JSON, static HTML downloads |
| Frontend coverage | `jacocoXml`, `coberturaXml`, `lcov`, `summaryJson`, `html`              | JaCoCo XML, Cobertura XML, LCOV, Istanbul summary JSON, static HTML downloads     |
| Requirements      | `expectedKeys`, `mapping`                                               | Expected requirement CSV, mapping JSON                                            |
| Security          | `codeqlSarif`, `zapJson`                                                | SARIF, OWASP ZAP JSON                                                             |
| Raw downloads     | `raw`                                                                   | Any files or directories copied as downloadable evidence                          |

Unsupported, malformed, or oversized structured files are skipped with controlled parser warnings. The structured parser size limit is 50 MiB per artifact.
