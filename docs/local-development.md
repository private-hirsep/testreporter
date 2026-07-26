# Local Development

Requirements:

- Node.js 22 LTS or newer
- npm

Install, verify, build, and generate a sample report:

```bash
npm ci
npx playwright install --with-deps chromium
npm run lint
npm run typecheck
npm test
npm run build
npm run check:workflows-docs
npm run release:smoke
npm run quality-report -- generate --config examples/minimal/quality-report.yml --quality-gates examples/minimal/quality-gates.yml --input examples/minimal/quality-artifacts --output dist/example-report --quality-profile relaxed --zip
```

The root `quality-report` script runs `packages/report-cli/dist/index.js`, so run `npm run build` before using the CLI locally.

The UI is a static Vue 3/Vite app. During generation, the CLI copies the built UI and writes report JSON into `data/`.

Clean generated output with:

```bash
npm run clean
```

The Playwright configuration uses its default Chromium project, so workflows and
local setup install Chromium only. `scripts/prepare-quality-runner.sh` also creates
the unit, E2E, and coverage reporter directories before any reporter writes.

The trusted self-report workflow runs the commands above against real repository
output, merges history through `scripts/persist-history.sh`, finalizes the audit
archive, stages the Pages artifact, and then deploys it in a separate job. Live
token writes and Pages deployment require GitHub; local contract checks verify the
ordering and permissions.
