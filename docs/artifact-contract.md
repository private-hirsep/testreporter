# Artifact Contract

The portal consumes artifacts. It does not prescribe how projects build, test, scan, or package their code.

Recommended layout:

```text
quality-artifacts/
├─ tests/
│  ├─ backend/
│  │  ├─ junit/
│  │  └─ raw/
│  ├─ frontend/
│  │  ├─ junit/
│  │  ├─ vitest/
│  │  └─ raw/
│  └─ e2e/
│     ├─ junit/
│     ├─ playwright/
│     └─ raw/
├─ coverage/
│  ├─ backend/
│  │  ├─ jacoco.xml
│  │  ├─ jacoco.csv
│  │  └─ html/
│  └─ frontend/
│     ├─ lcov.info
│     ├─ coverage-summary.json
│     └─ html/
├─ requirements/
│  ├─ expected.csv
│  └─ mapping.json
├─ security/
│  ├─ codeql/
│  └─ zap/
└─ meta/
   └─ manifest.yml
```

This layout is recommended, not required. Any project may use different artifact names or paths if `quality-report.yml` maps them explicitly.

Globs are resolved relative to the downloaded artifact directory: `--input` for local CLI runs and `artifact-path` for the reusable workflow.

Raw third-party HTML reports can be copied and linked as static downloads. The main SPA does not embed arbitrary HTML.

Generated report JSON stores safe relative source labels and generated raw asset links. It should not expose absolute local filesystem paths from the machine that ran the generator.
