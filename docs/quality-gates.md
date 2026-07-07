# Quality Gates

Quality gates evaluate normalized summaries:

- failed and broken test limits
- total/backend/frontend coverage minimums
- requirement coverage minimum
- missing requirement policy
- critical/high security finding limits

If generation succeeds but a quality gate fails, the CLI exits with status `1`.
Malformed required configuration exits with status `2`.
