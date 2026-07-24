#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

report="${1:-site/normalized-report.json}"
site="${2:-site}"
tool="${3:-.}"
config="${4:-quality-report.yml}"
branch="${HISTORY_BRANCH:-quality-history}"
attempts="${HISTORY_PUSH_ATTEMPTS:-3}"
workspace="${GITHUB_WORKSPACE:-$PWD}"
remote="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
run_id="$(jq -er '.metadata.runId // (.unifiedExecutions[] | select(.type == "automated") | .id)' "$report")"

for attempt in $(seq 1 "$attempts"); do
  echo "History persistence attempt ${attempt}/${attempts}"
  rm -rf "${workspace}/history-checkout" "${workspace}/next-history"
  mkdir -p "${workspace}/history-checkout"
  git -C "${workspace}/history-checkout" init
  git -C "${workspace}/history-checkout" remote add origin "$remote"

  if git -C "${workspace}/history-checkout" fetch --depth=1 origin "$branch"; then
    git -C "${workspace}/history-checkout" checkout -B "$branch" FETCH_HEAD
  else
    git -C "${workspace}/history-checkout" checkout --orphan "$branch"
    mkdir -p "${workspace}/history-checkout/quality-history/v1"
  fi

  node "${tool}/packages/report-cli/dist/index.js" history merge \
    --config "$config" \
    --history-dir "${workspace}/history-checkout/quality-history" \
    --current-report "$report" \
    --output-dir "${workspace}/next-history/quality-history" \
    --static-output "${site}/data/history.json" \
    --project-summary-output "${site}/project-quality-summary.json"

  rm -rf "${workspace}/history-checkout/quality-history"
  cp -R "${workspace}/next-history/quality-history" "${workspace}/history-checkout/quality-history"
  git -C "${workspace}/history-checkout" add quality-history

  if git -C "${workspace}/history-checkout" diff --cached --quiet; then
    if jq -e --arg id "$run_id" '.runs[] | select(.id == $id)' \
      "${workspace}/history-checkout/quality-history/v1/index.json" >/dev/null; then
      echo "History already persisted remotely for ${run_id}."
      exit 0
    fi
    echo "::warning::No local history diff, but remote does not contain ${run_id}; retrying."
    continue
  fi

  git -C "${workspace}/history-checkout" \
    -c user.name=github-actions \
    -c user.email=41898282+github-actions[bot]@users.noreply.github.com \
    commit -m "chore(history): record quality run ${run_id}"
  if git -C "${workspace}/history-checkout" push origin "HEAD:${branch}"; then
    echo "History persisted for ${run_id}."
    exit 0
  fi
  echo "::warning::Push conflict; refetching and remerging from remote."
done

echo "::error::History persistence failed after ${attempts} attempts."
exit 1
