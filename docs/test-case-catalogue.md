# Logical test cases and unified executions

The generated report distinguishes an imported result from a logical test case. An imported automated result is one technical implementation in the current run. A logical case groups implementations only by exact canonical identity; automated tests do not need a duplicate YAML definition.

## Catalogue grouping

Canonical ID is the only association key. Matching a requirement, title, tag, source file, or similar wording never merges cases. Exact canonical-ID equality can therefore create:

- **automated** cases, with automated implementations only;
- **manual** cases, with a Git-tracked manual definition only;
- **hybrid** cases, where an automated identity and manual definition use the same canonical ID.

Canonical identity and technical implementation identity serve different purposes. Canonical identity groups a logical case. Technical identity separates executable implementations using framework, layer, suite, title, source location, and explicit adapter-provided variant dimensions. Playwright currently supports project, browser, device, and operating-system/platform variant metadata when those values exist in its report. Requirement, defect, case-identity, tag, ownership, source, and arbitrary annotation labels are not variants.

Retries are grouped only within an identical technical implementation identity. Explicit adapter attempt metadata takes precedence; otherwise repeated results may be inferred as retries only after the complete variant-aware identity matches. Chromium and Firefox, or desktop and mobile, therefore remain separate implementations and do not increase each other's retry count.

Conflicted explicit identities preserve every implementation and link to Diagnostics. Catalogue derivation and identity diagnostics use the same compatibility analysis: the canonical-ID token and separately represented bracketed variant values are removed, then exact normalized logical titles are compared. Compatible browser, device, operating-system, and project implementations are recorded as informational multi-implementation IDs, not duplicate warnings. Clearly different normalized logical titles are conflicts, including incompatible approved manual and automated titles. No fuzzy title similarity is used. Final diagnostics build the complete conflict set first and remove those IDs from the compatible collection, so an incompatible manual definition always takes precedence over otherwise-compatible automated variants. Conflicts are marked unstable and do not claim reliable continuity. Display titles are selected deterministically: approved manual title, stable explicit automated title, newest implementation title, then lexical order.

## Current result, stability, and duration

Each implementation selects its latest official available result first. Logical status then uses the most severe active implementation: broken, failed, blocked, not-run, skipped, passed, unknown. A pass cannot hide another implementation's active failure. Last executed is calculated independently as the newest valid timestamp across active implementations, so a newer pass updates the date without hiding an older active failure in another variant. Draft and deprecated manual definitions do not contribute an active result; only completed, CLI-validated imported manual executions are official.

Stability uses unified executions present in the generated report. All implementation snapshots for one logical case in the current automated run are first aggregated with the normal worst-status precedence, producing exactly one automated execution sample regardless of browser count. Each completed, validated manual execution produces one additional sample. Drafts, invalid executions, variants, and normalized retry rows do not add history samples. One sample is reported as **Insufficient history**. A rate always includes its execution sample size. A passing execution may be labelled flaky only when an execution snapshot explicitly records retries; mixed browser outcomes are not flaky. No long-term trend is inferred.

For a conflicted canonical identity, samples and counts remain available for diagnosis but logical stability is marked unavailable with the reason `identity-conflict`. The UI displays **Stability unavailable due to identity conflict** and suppresses pass rate and flaky continuity claims until the conflict is resolved.

Invalid, negative, or missing durations are ignored. Catalogue average, median, minimum, and maximum use all valid implementation samples. Latest duration comes from the newest valid case execution timestamp; equal timestamps use ascending technical implementation ID, and latest is unavailable when no reliable timestamp exists. This avoids implying temporal order from artifact order.

Automated per-test durations are summed at run level and labelled **Summed test time**; concurrent test durations are not presented as wall-clock duration. `durationMs` on an execution is reserved for a genuine run-level wall-clock measurement. On a test-case execution tab, only that case's execution snapshots are used: each implementation duration is shown separately and an optional total is labelled **Summed case implementation time**. Whole-run timing is never substituted for case timing. Manual execution wall-clock duration may be derived from reliable start and completion timestamps, but it is not used as the manual case duration when the case snapshot has none.

## Unified executions

The current automated report is one execution, never one per test. Its ID uses existing run/workflow metadata, or a deterministic technical ID derived from stable report metadata. Report `generatedAt` is retained as `reportedAt` and labelled **Report generated**; it is not test completion evidence and is not used to infer a start time. Run start, completion, and wall-clock duration remain unavailable unless genuine run-level metadata exists.

Every unified execution contains case-result snapshots recorded for that execution. Automated snapshots retain the final normalized implementation ID, status, duration, and evidence references. Manual snapshots retain that execution's status, notes, defects, duration, and evidence. Execution details never substitute the catalogue's newer current result for an older execution's recorded result.

Automated execution status is failed when any result failed or broke, unknown when any unsupported/unknown result exists, passed when at least one test passed and all others passed or skipped, and incomplete when all results are skipped or not run. Blocked is used only when the underlying status genuinely supplies it. Every completed, validated imported manual execution is a separate execution. Browser-local drafts, imported drafts, unknown cases, and results rejected by existing validation are excluded.

Catalogue counts, quick filters, sorting, and filters operate on logical catalogue entries. Requirement navigation uses the catalogue's merged references, so automated-only, manual-only, and hybrid cases appear once even when several variants cover the same requirement. Large catalogues are filtered before pagination and render 50 entries by default, with 25, 50, and 100 entry options.

The static routes are:

- `#/tests` and the compatibility alias `#/test-cases`;
- `#/tests/:canonicalId` for logical case details (legacy technical IDs resolve when unambiguous);
- `#/history` and the compatibility alias `#/executions`;
- `#/executions/:executionId`;
- `#/requirements#requirement-:encodedId`;
- `#/downloads#evidence-artifacts` and `#/evidence`.

Route parameters use router encoding and centralized helpers. Requirements, cases, executions, and evidence link to one another. Older manifests without `testCaseCatalogue` or `unifiedExecutions` remain readable: automated cases receive a minimal presentation-only fallback and the executions page shows a focused compatibility message.

Older unified executions without `caseResults` remain navigable, but the UI reports that execution-specific case results are unavailable. Mixed reports show complete current rows and unsupported older rows together; an old row displays **Unavailable** and **Not recorded** without hiding newer snapshot data. It does not substitute the current catalogue status or whole-run duration. Older catalogue fallbacks report unavailable execution history and do not infer a latest duration without a reliable timestamp.

## Historical limitations and future work

This version contains the current automated execution and imported manual executions only. It does not download CI artifacts, persist summaries between builds, merge earlier workflow runs, store cross-release trends, or manufacture flaky trends. Those historical summaries and trends are deferred to PR 3. Test-plan editing, Jira synchronization, browser case editing, backend services, user accounts, portfolio history, AI recommendations, and new quality/readiness rules also remain out of scope.
