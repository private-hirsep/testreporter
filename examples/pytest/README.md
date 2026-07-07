# Pytest Example

Pytest projects should publish JUnit XML with:

```bash
pytest --junitxml=quality-artifacts/tests/backend/junit/pytest.xml
```

Requirement keys can be carried in test names, JUnit properties, markers rendered
to properties, or an explicit mapping file.
