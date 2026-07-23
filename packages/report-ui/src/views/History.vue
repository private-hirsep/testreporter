<template>
  <div v-if="manifest">
    <PageHeader title="Executions" :subtitle="`${filtered.length} automated and manual execution(s) genuinely available in this static report`" />
    <v-alert type="info" variant="tonal" class="mb-4">
      This report contains the current automated execution and imported manual executions. Historical automated runs have not been merged yet.
    </v-alert>
    <v-alert v-if="!manifest.unifiedExecutions" type="info" variant="tonal" class="mb-4">
      This older report does not contain unified execution summaries. Its legacy history remains readable, but case-level execution links are unavailable.
    </v-alert>
    <div class="toolbar execution-toolbar" role="search" aria-label="Filter executions">
      <v-text-field v-model="search" label="Search executions" density="compact" hide-details prepend-inner-icon="mdi-magnify" />
      <v-select v-model="type" :items="['all','automated','manual']" label="Type" density="compact" hide-details />
      <v-select v-model="status" :items="statusOptions" label="Status" density="compact" hide-details />
      <v-select v-model="release" :items="releaseOptions" label="Release" density="compact" hide-details />
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
        <td>{{ formatDate(execution.completedAt ?? execution.startedAt) }}</td><td class="mono">{{ formatDuration(execution.durationMs) }}</td>
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
import { executionRoute } from "../services/routes";
import type { Manifest, TestCase, UnifiedExecution } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const search = ref(""); const type = ref("all"); const status = ref("all"); const release = ref("all"); const environment = ref("all"); const failure = ref("all"); const evidence = ref("all"); const sort = ref("newest");
const executions = computed(() => executionsFor(props.manifest));
const options = (values: Array<string | undefined>) => ["all", ...new Set(values.filter((value): value is string => Boolean(value)).sort())];
const statusOptions = ["all","passed","failed","blocked","incomplete","unknown"];
const releaseOptions = computed(() => options(executions.value.map((item) => item.release)));
const environmentOptions = computed(() => options(executions.value.map((item) => item.environment)));
const sortOptions = [{title:"Newest first",value:"newest"},{title:"Oldest first",value:"oldest"},{title:"Status severity",value:"status"},{title:"Duration",value:"duration"},{title:"Failed count",value:"failed"}];
const failed = (item: UnifiedExecution) => item.counts.failed + (item.counts.broken ?? 0) + (item.counts.blocked ?? 0);
const severity: Record<string,number> = { failed:0, blocked:1, incomplete:2, unknown:3, passed:4 };
const time = (item: UnifiedExecution) => Date.parse(item.completedAt ?? item.startedAt ?? "0") || 0;
const filtered = computed(() => executions.value
  .filter((item) => `${item.id} ${item.release ?? ""} ${item.branch ?? ""} ${item.environment ?? ""} ${item.commit ?? ""}`.toLowerCase().includes(search.value.toLowerCase()))
  .filter((item) => type.value === "all" || item.type === type.value).filter((item) => status.value === "all" || item.status === status.value)
  .filter((item) => release.value === "all" || item.release === release.value).filter((item) => environment.value === "all" || item.environment === environment.value)
  .filter((item) => failure.value === "all" || (failure.value === "contains failures") === (failed(item) > 0))
  .filter((item) => evidence.value === "all" || (evidence.value === "complete") === Boolean(item.evidence?.complete))
  .sort((a,b) => sort.value === "oldest" ? time(a)-time(b) : sort.value === "status" ? (severity[a.status]??9)-(severity[b.status]??9) : sort.value === "duration" ? (b.durationMs??-1)-(a.durationMs??-1) : sort.value === "failed" ? failed(b)-failed(a) : time(b)-time(a) || a.id.localeCompare(b.id)));
function formatDate(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Unknown"; }
</script>
