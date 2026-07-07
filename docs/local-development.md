# Local Development

Requirements:

- Node.js 22 LTS or newer
- npm

Commands:

```bash
npm install
npm run typecheck
npm test
npm run build
npm run quality-report -- generate --config examples/minimal/quality-report.yml --input examples/minimal/quality-artifacts --output dist/example-report
npm run test:e2e
```

The UI is a static Vue 3/Vite app. During generation, the CLI copies the built UI
and writes report JSON into `data/`.
