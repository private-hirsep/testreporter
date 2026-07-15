# Lightweight manual testing

Manual YAML is intended only for checks that cannot reasonably be automated. Store one case per file under version control so reviews and Git history show exactly how a definition changed. Automated result formats remain the source for automated tests.

Configure `artifacts.manual.cases`, `artifacts.manual.results`, and optionally `artifacts.manual.evidence` using the same glob rules as other artifacts. Cases and completed executions are validated as untrusted data and displayed as plain text; HTML is never interpreted.

Open **Manual Testing** in a generated report, choose a case, and work through the runner. Progress is saved in browser `localStorage` under the immutable generated-report context, so editing execution metadata does not orphan the draft. It survives reloads, can be discarded, and contains references—not embedded attachments. Evidence references must use the exact input-relative configured artifact path (for example `manual-evidence/screenshot.png`). A local draft is convenience state, not audit evidence.

Complete or skip every case, then export JSON. Add the stable JSON file and referenced evidence files to the configured CI artifact paths—normally by committing them or placing them in the workflow workspace—and generate the report again. Only an imported, schema-valid result becomes official evidence and enters the report ZIP.

The result records schema version, execution/project/release/build context, environment, tester, times, case and step statuses, actual results, notes, defects, and evidence references. The no-backend design deliberately provides no accounts, collaboration, server attachments, Git write-back, or automatic CI upload. Browser storage is device/profile-local and may be cleared by the browser.

Manual gates are disabled unless configured under `qualityGates.manual`: `requireCompleted`, `failOnFailed`, `failOnBlocked`, and `minimumCompletion`.
