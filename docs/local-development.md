# Local Development

Requirements:

- Node.js 22 LTS or newer
- npm

Install, verify, build, and generate a sample report:

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run check:workflows-docs
npm run quality-report -- generate --config examples/minimal/quality-report.yml --quality-gates examples/minimal/quality-gates.yml --input examples/minimal/quality-artifacts --output dist/example-report --quality-profile relaxed --zip
```

The root `quality-report` script runs `packages/report-cli/dist/index.js`, so run `npm run build` before using the CLI locally.

The UI is a static Vue 3/Vite app. During generation, the CLI copies the built UI and writes report JSON into `data/`.

Clean generated output with:

```bash
npm run clean
```

The dogfood workflow depends on GitHub Actions artifact download, PR comments, and Pages deployment. Use local CLI generation for report checks and `workflow_dispatch` for end-to-end workflow behavior.
