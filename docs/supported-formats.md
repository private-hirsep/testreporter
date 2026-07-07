# Supported Formats

Milestone one supports:

- Generic JUnit XML, Pytest JUnit XML, Maven Surefire/Failsafe XML
- Vitest JSON and JUnit XML
- Playwright JSON and JUnit XML
- JaCoCo XML and CSV
- Istanbul `coverage-summary.json`
- LCOV
- Cobertura XML
- CodeQL/SARIF
- OWASP ZAP JSON

Unsupported or malformed files are skipped with controlled warnings. The parser
size limit is 50 MiB per structured artifact.
