#!/usr/bin/env bash
set -euo pipefail

mkdir -p \
  quality-artifacts/tests/unit \
  quality-artifacts/tests/e2e \
  quality-artifacts/coverage

# playwright.config.ts defines no additional browser projects, so the default
# suite uses Chromium only.
npx playwright install --with-deps chromium
