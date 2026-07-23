# User Interface

The generated report is a static, backend-free QA workspace. Everything it shows comes from
files generated at build time; configuration and test-case definitions stay in Git, and nothing
is edited from the browser.

## Navigation structure

Every page shares one application shell: a sidebar with the workspace sections, a project
context header, and a consistent page layout. The sections are:

| Section           | Route          | Contents                                                                                          |
| ----------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| Overview          | `#/`           | Release status, required QA actions, current failures, and secondary quality signals               |
| Test Cases        | `#/tests`      | Automated tests imported from this run, with identity, requirements, and source metadata           |
| Executions        | `#/history`    | The current automated run and imported manual executions; states clearly when history is absent    |
| Release Readiness | `#/readiness`  | Why the release is or is not ready: reasons, actions, accepted risks, and evidence completeness    |
| Requirements      | `#/requirements` | Requirement-to-evidence traceability, including automated and manual evidence                    |
| Manual Testing    | `#/manual`     | Git-tracked manual case definitions, imported executions, and the browser-local runner             |
| Coverage          | `#/coverage`   | Layer and file-level coverage parsed from static artifacts                                         |
| Security          | `#/security`   | Findings from SARIF/ZAP artifacts                                                                  |
| Evidence          | `#/downloads`  | Audit integrity files, the report ZIP, and every raw artifact grouped by category                   |
| Diagnostics       | `#/diagnostics` | Identity health plus parser warnings grouped by category                                          |

Renamed sections keep their historical route paths, and aliases exist for the new names
(`#/evidence` → `#/downloads`, `#/executions` → `#/history`, `#/test-cases` → `#/tests`,
`#/overview` → `#/`). Existing deep links keep working.

## Project context header

The header above every page shows the fields that exist in the report metadata — project,
release, branch, environment, tested build, commit, last-generated date, and workflow run —
and simply omits fields the report does not have. The chip on the right is the overall status:
release readiness when the report has readiness data, otherwise the quality-gate result,
otherwise an explicit “Unavailable”.

## Status semantics

The same semantic state always uses the same label, icon, and color, and never relies on color
alone:

| Status                    | Meaning                                                       |
| ------------------------- | ------------------------------------------------------------- |
| Passed / Ready / Covered  | Executed and met expectations, or readiness criteria satisfied |
| Failed / Blocked          | Did not meet expectations, or a blocker prevents release       |
| Broken                    | Failed for infrastructure or setup reasons                    |
| Warning                   | Needs attention but is not blocking                           |
| Incomplete                | Required data or executions are still missing                 |
| Not run                   | Execution has not started                                     |
| Skipped                   | Deliberately not executed in this run                         |
| Accepted risk             | A known issue accepted with a documented reason               |
| Unavailable               | The report does not contain the required data                 |
| Info                      | Informational only                                            |

## Test Cases versus Executions

**Test Cases** lists the automated tests imported from the current run — their identity,
status, requirements, and source. **Executions** is about runs: the current automated run’s
summary and any completed manual executions imported as official data. Static reports contain
a single run today, and the Executions page says so instead of showing an invented trend.
Cross-run test-case grouping and historical trends are follow-up work.

## Release Readiness versus Evidence

**Release Readiness** answers “can we ship?” — it explains the current status through its
reasons, lists required QA actions, accepted risks, scoped requirements, and whether declared
evidence is complete. **Evidence** answers “where is the proof?” — the audit integrity files
(`evidence-manifest.json`, `checksums.sha256`), the full report ZIP, and every raw artifact
the report was built from, grouped by category.

## Portfolio

`quality-report portfolio` renders a static multi-project page from
`project-quality-summary.json` files using the same design language as the report. Projects
are sorted by the existing deterministic attention priority (blocked first), stale summaries
are labeled and never shown as healthy, and each card links to the full project report.
See [release-readiness.md](release-readiness.md) for the summary format.

## Responsive behavior

The sidebar is permanent on desktop widths and becomes a toggleable drawer below ~960 px.
Summary cards stack, tables scroll horizontally inside their cards, and the manual runner
remains fully usable at narrow phone widths (tested at 390 px).

## Accessibility

The shell provides a skip-to-content link, landmark structure, keyboard-reachable controls
with visible focus states, `aria-sort` on sortable table headers, labeled icon-only buttons,
and reduced-motion support. Status chips combine icon, text, and a description tooltip so no
state is communicated by color alone.
