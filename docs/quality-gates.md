# Quality Gates

Quality gates evaluate normalized summaries:

- failed and broken test limits
- total/backend/frontend coverage minimums
- requirement coverage minimum
- missing requirement policy
- critical/high security finding limits

Defaults are intentionally strict:

- failed tests must be `<= 0`
- broken tests must be `<= 0`
- critical findings must be `<= 0`
- high findings must be `<= 0`

Projects can relax or extend thresholds in `quality-report.yml`.

If generation succeeds but a quality gate fails, the CLI exits with status `1`.
Malformed required configuration exits with status `2`.
