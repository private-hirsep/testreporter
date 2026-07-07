# Requirement Coverage

Requirement keys are normalized into the test model. The default key pattern is:

```text
[A-Z]+-[0-9]+
```

Projects can override it with `requirements.keyPattern`.

Supported mapping sources:

- JUnit XML properties
- Playwright annotations and tags
- Vitest metadata or names
- Pytest/JUnit properties
- Explicit mapping JSON
- Fallback regex scan of test name, suite, file, and labels

`expected.csv` should contain one requirement key per row. A header row with
`key` is allowed.
