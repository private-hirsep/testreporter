# Quality Gates

Quality gates are selected with `--quality-profile` or the reusable workflow
`quality-profile` input. Built-in profiles are:

- `off`: report-only mode. The gate status is `skipped`.
- `relaxed`: adoption/demo/dev-friendly thresholds.
- `standard`: normal pull request defaults.
- `strict`: merge queue and protected branch defaults.
- `release`: release candidate defaults.
- `custom`: requires a profile named `custom` in the custom gate file.

Gate status is one of `passed`, `failed`, `skipped`, or `not_evaluated`.

Built-in thresholds:

| Profile | Failed/Broken Tests | Coverage | Requirements | Security | Warnings |
|---|---:|---:|---:|---:|---:|
| `relaxed` | 3 / 2 | 70 total, 70 backend, 60 frontend | 75%, missing allowed | 0 critical, 0 high, 5 medium | 20 |
| `standard` | 0 / 0 | 80 total, 80 backend, 75 frontend | 90%, missing fails | 0 critical, 0 high, 3 medium | 10 |
| `strict` | 0 / 0 | 85 total, 85 backend, 80 frontend | 100%, missing/extra fail | 0 critical, 0 high, 0 medium | 0 |
| `release` | 0 / 0 | 85 total, 85 backend, 85 frontend | 100%, missing/extra fail | 0 critical, 0 high, 0 medium | 0 |

Custom profiles live in `quality-gates.yml`:

```yaml
profiles:
  pr:
    extends: standard
    coverage:
      totalMinimum: 75

  merge-queue:
    extends: strict

  release:
    extends: release
    coverage:
      totalMinimum: 90
      backendMinimum: 90
      frontendMinimum: 85
```

Custom profiles can extend built-ins or other custom profiles. Invalid profile
names, invalid thresholds, circular `extends`, and invalid YAML produce clear
errors.

The selected profile is written to `data/manifest.json`, displayed in the UI, and
included in `meta/quality-summary.json`.
