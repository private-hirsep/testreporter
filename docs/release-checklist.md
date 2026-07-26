# Release checklist

- [ ] Fresh clone using supported Node 22
- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] Generate report without history
- [ ] Initialize history and generate a second historical run
- [ ] Verify idempotent reprocessing and workflow-attempt rerun
- [ ] Verify manual-only and empty-report persistence
- [ ] Simulate concurrent update without force push
- [ ] Verify Pages artifact and deployment contract
- [ ] Publish a project summary and generate a three-project portfolio
- [ ] Verify audit ZIP and checksums
- [ ] Review desktop, tablet, mobile, and keyboard navigation
- [ ] Check documentation links and clean Git status
- [ ] Review release notes and package versions

Live token permissions, branch races, and Pages deployment must be checked in
GitHub Actions; local contract tests are not substitutes for that exercise.
