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
run_id="$(
  jq -r '
    .metadata.runId //
    ([.unifiedExecutions[]? | select(.type == "automated") | .id][0]) //
    empty
  ' "$report"
)"
manual_count="$(
  jq '[.manualExecutions[]? | select(.executionId and .completedAt)] | length' "$report"
)"
history_label="${run_id:-manual-executions}"

if [[ -z "$run_id" && "$manual_count" -eq 0 ]]; then
  echo "No new automated or manual executions to persist."
  exit 0
fi

if [[ -f "$config" ]]; then
  config="$(cd "$(dirname "$config")" && pwd)/$(basename "$config")"
elif [[ "$config" != /* && -f "${tool}/${config}" ]]; then
  config="$(cd "$tool" && pwd)/$config"
else
  echo "::error::History configuration file was supplied but could not be resolved: ${config}"
  exit 2
fi

verify_remote() {
  git -C "${workspace}/history-checkout" fetch --depth=1 origin "$branch"
  git -C "${workspace}/history-checkout" reset --hard FETCH_HEAD
  node "${tool}/packages/report-cli/dist/index.js" history verify \
    --config "$config" \
    --history-dir "${workspace}/history-checkout/quality-history" \
    --current-report "$report"
}

finalize_site() {
  node "${tool}/packages/report-cli/dist/index.js" finalize --output "$site"
}

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
    if verify_remote; then
      finalize_site
      echo "History already persisted remotely for ${history_label}."
      exit 0
    fi
    echo "::warning::No local history diff, but remote lacks the exact content for ${history_label}; retrying."
    continue
  fi

  git -C "${workspace}/history-checkout" \
    -c user.name=github-actions \
    -c user.email=41898282+github-actions[bot]@users.noreply.github.com \
    commit -m "$(
      if [[ -n "$run_id" ]]; then
        printf 'chore(history): record quality run %s' "$run_id"
      else
        printf 'chore(history): record manual executions'
      fi
    )"
  if git -C "${workspace}/history-checkout" push origin "HEAD:${branch}"; then
    if verify_remote; then
      finalize_site
      echo "History persisted and verified for ${history_label}."
      exit 0
    fi
    echo "::warning::Push completed but exact remote verification failed; retrying."
  fi
  echo "::warning::Push conflict; refetching and remerging from remote."
done

echo "::error::History persistence failed after ${attempts} attempts."
exit 1
