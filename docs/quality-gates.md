# Quality Gates

Quality gates are selected with the CLI `--quality-profile` option or the reusable workflow `quality-profile` input. The canonical reusable workflow uses the CLI profile implementation in `packages/report-cli/src/config.ts`.

Gate status is `passed`, `failed`, or `skipped`.

## Built-In Profiles

| Profile    | Failed tests | Broken tests | Total coverage | Backend coverage | Frontend coverage | Requirement coverage | Missing reqs | Extra reqs |  Critical |      High |    Medium |  Warnings |
| ---------- | -----------: | -----------: | -------------: | ---------------: | ----------------: | -------------------: | ------------ | ---------- | --------: | --------: | --------: | --------: |
| `off`      |    <= 999999 |    <= 999999 |        skipped |          skipped |           skipped |              skipped | allowed      | allowed    | <= 999999 | <= 999999 | <= 999999 | <= 999999 |
| `relaxed`  |         <= 3 |         <= 2 |         >= 60% |          skipped |           skipped |               >= 60% | allowed      | allowed    |         0 |      <= 5 |     <= 10 |     <= 20 |
| `standard` |            0 |            0 |         >= 70% |          skipped |           skipped |               >= 75% | allowed      | allowed    |         0 |         0 |      <= 3 |     <= 10 |
| `strict`   |            0 |            0 |         >= 85% |           >= 85% |            >= 80% |               >= 90% | fail         | fail       |         0 |         0 |         0 |         0 |
| `release`  |            0 |            0 |         >= 90% |           >= 90% |            >= 85% |                 100% | fail         | fail       |         0 |         0 |         0 |         0 |

Use `off` for report-only adoption, `relaxed` for early signal collection, `standard` for normal pull requests, `strict` for merge queues or protected branches, and `release` for release readiness.

## Custom Profiles

Custom profiles can be defined in `quality-report.yml` or in a separate file passed with `--quality-gates` / `quality-gates-path`.

```yaml
qualityGateProfiles:
  pr:
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

  merge-queue:
    tests:
      allowFailed: 0
      allowBroken: 0
    coverage:
      totalMinimum: 85
      backendMinimum: 85
      frontendMinimum: 80
    requirements:
      minimum: 90
      failOnMissing: true
      failOnExtra: true
    security:
      maxCritical: 0
      maxHigh: 0
      maxMedium: 0
    warnings:
      maxWarnings: 0

  release:
    tests:
      allowFailed: 0
      allowBroken: 0
    coverage:
      totalMinimum: 90
      backendMinimum: 90
      frontendMinimum: 85
    requirements:
      minimum: 100
      failOnMissing: true
      failOnExtra: true
    security:
      maxCritical: 0
      maxHigh: 0
      maxMedium: 0
    warnings:
      maxWarnings: 0
```

Current CLI custom profiles are direct profile objects. Profile `extends` chains are not implemented on the canonical workflow path.

Unknown profile names, invalid thresholds, and invalid YAML fail validation before generation.
