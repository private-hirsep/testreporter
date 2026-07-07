# Java + Node + Playwright Example

This placeholder documents the intended adoption shape for a mixed project:

1. Maven or Gradle publishes Surefire/Failsafe JUnit XML and JaCoCo XML.
2. npm/pnpm publishes Vitest JUnit or JSON plus Istanbul/LCOV coverage.
3. Playwright publishes JSON or JUnit.
4. CodeQL and ZAP publish SARIF and ZAP JSON.
5. The report generator consumes those artifacts through `quality-report.yml`.
