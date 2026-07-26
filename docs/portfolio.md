# Portfolio

Trusted project workflows publish the final history-aware
`project-quality-summary.json` to stable paths in a summary repository or branch.
The central workflow checks out that store and runs `quality-report portfolio`.

Portfolio generation is static and read-only. If no valid summaries exist, it
shows an intentional empty state. Current-only summaries remain valid but cannot
claim historical trends. Authentication to a central private store is required
only in the producer/portfolio workflow, never in a pull-request report.
