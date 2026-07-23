<template>
  <div v-if="manifest">
    <PageHeader title="Executions" :subtitle="`${filtered.length} automated and manual execution(s) genuinely available in this static report`" />
    <v-alert v-if="!historyData" type="info" variant="tonal" class="mb-4">
      Historical execution summaries have not been imported for this report.
    </v-alert>
    <v-alert v-if="!manifest.unifiedExecutions" type="info" variant="tonal" class="mb-4">
      This older report does not contain unified execution summaries. Its legacy history remains readable, but case-level execution links are unavailable.
    </v-alert>
    <div class="toolbar execution-toolbar" role="search" aria-label="Filter executions">
      <v-text-field v-model="search" label="Search executions" density="compact" hide-details prepend-inner-icon="mdi-magnify" />
      <v-select v-model="type" :items="['all','automated','manual']" label="Type" density="compact" hide-details />
      <v-select v-model="status" :items="statusOptions" label="Status" density="compact" hide-details />
      <v-select v-model="release" :items="releaseOptions" label="Release" density="compact" hide-details />
      <v-select v-model="branch" :items="branchOptions" label="Branch" density="compact" hide-details />
      <v-select v-model="environment" :items="environmentOptions" label="Environment" density="compact" hide-details />
      <v-select v-model="failure" :items="['all','contains failures','no failures']" label="Failures" density="compact" hide-details />
      <v-select v-model="evidence" :items="['all','complete','incomplete']" label="Evidence" density="compact" hide-details />
      <v-select v-model="sort" :items="sortOptions" label="Sort" density="compact" hide-details />
    </div>
    <EmptyState v-if="!filtered.length" message="No unified executions match the current filters." />
    <div v-else class="table-scroll"><v-table density="compact" class="data-table">
      <thead><tr><th scope="col">Execution</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Release / branch / environment</th><th scope="col">Commit</th><th scope="col">Completed</th><th scope="col">Duration</th><th scope="col">Counts</th><th scope="col">Cases / requirements</th><th scope="col">Evidence</th></tr></thead>
      <tbody><tr v-for="execution in filtered" :key="execution.id">
        <td><router-link :to="executionRoute(execution.id)" class="mono">{{ execution.id }}</router-link></td>
        <td><v-chip size="small" variant="tonal" label>{{ execution.type }}</v-chip></td><td><StatusChip :status="execution.status" /></td>
        <td>{{ execution.release ?? "n/a" }} / {{ execution.branch ?? "n/a" }} / {{ execution.environment ?? "n/a" }}</td>
        <td class="mono cell-truncate" :title="execution.commit">{{ execution.commit?.slice(0, 12) ?? "n/a" }}</td>
        <td>{{ timeLabel(execution) }}</td><td class="mono"><span v-if="execution.durationMs">Wall clock {{ formatDuration(execution.durationMs) }}</span><span v-else-if="execution.testDurationSumMs">Summed test time {{ formatDuration(execution.testDurationSumMs) }}</span><span v-else>n/a</span></td>
        <td>{{ execution.counts.passed }} passed · {{ failed(execution) }} failed</td>
        <td>{{ execution.testCaseIds.length }} / {{ execution.requirementIds.length }}</td>
        <td>{{ execution.evidence?.complete ? "Complete" : "Incomplete" }} · {{ execution.evidence?.referenceCount ?? 0 }}</td>
      </tr></tbody>
    </v-table></div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatDuration } from "../format";
import { executionsFor } from "../services/catalogue";
import { historicalExecutions } from "../services/history";
import {
  executionFailureCount,
  filterExecutions,
  sortExecutions
} from "../services/executionView";
import { executionRoute } from "../services/routes";
import type { HistoryArtifact, Manifest, TestCase, UnifiedExecution } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[]; historyData?: HistoryArtifact }>();
const search = ref(""); const type = ref("all"); const status = ref("all"); const release = ref("all"); const branch = ref("all"); const environment = ref("all"); const failure = ref("all"); const evidence = ref("all"); const sort = ref("newest");
const executions = computed(() => [
  ...executionsFor(props.manifest),
  ...historicalExecutions(props.manifest, props.historyData)
]);
const options = (values: Array<string | undefined>) => ["all", ...new Set(values.filter((value): value is string => Boolean(value)).sort())];
const statusOptions = ["all","passed","failed","blocked","incomplete","unknown"];
const releaseOptions = computed(() => options(executions.value.map((item) => item.release)));
const branchOptions = computed(() => options(executions.value.map((item) => item.branch)));
const environmentOptions = computed(() => options(executions.value.map((item) => item.environment)));
const sortOptions = [{title:"Newest first",value:"newest"},{title:"Oldest first",value:"oldest"},{title:"Status severity",value:"status"},{title:"Duration",value:"duration"},{title:"Failed count",value:"failed"}];
const failed = executionFailureCount;
const filtered = computed(() => sortExecutions(filterExecutions(executions.value, {
  search: search.value,
  type: type.value,
  status: status.value,
  release: release.value,
  branch: branch.value,
  environment: environment.value,
  failure: failure.value,
  evidence: evidence.value
}), sort.value));
function formatDate(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Unknown"; }
function timeLabel(execution: UnifiedExecution) { return execution.completedAt ? formatDate(execution.completedAt) : execution.startedAt ? formatDate(execution.startedAt) : execution.reportedAt ? `Report generated ${formatDate(execution.reportedAt)}` : "Unknown"; }
</script>
