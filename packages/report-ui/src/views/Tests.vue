<template>
  <div v-if="manifest">
    <PageHeader
      title="Test Cases"
      :subtitle="`Logical automated and manual catalogue · ${filtered.length} of ${catalogue.length} shown`"
    >
      <StatusChip :status="attentionCount ? 'failed' : 'passed'" :label="`${attentionCount} need attention`" />
    </PageHeader>
    <v-alert v-if="!manifest.testCaseCatalogue" type="info" variant="tonal" class="mb-4">
      Compatibility view: this older report has no logical catalogue data, so automated results are shown as individual cases.
    </v-alert>
    <div class="tab-strip" role="group" aria-label="Test result filters">
      <v-btn
        v-for="tab in tabs"
        :key="tab.value"
        size="small"
        :variant="view === tab.value ? 'flat' : 'outlined'"
        :aria-pressed="view === tab.value ? 'true' : 'false'"
        @click="view = tab.value"
      >{{ tab.label }} {{ tab.count }}</v-btn>
    </div>
    <div class="toolbar catalogue-toolbar" role="search" aria-label="Filter test case catalogue">
      <v-text-field v-model="search" label="Search catalogue" density="compact" hide-details prepend-inner-icon="mdi-magnify" clearable />
      <v-select v-model="status" :items="statusOptions" label="Status" density="compact" hide-details />
      <v-select v-model="type" :items="typeOptions" label="Type" density="compact" hide-details />
      <v-select v-model="identity" :items="identityOptions" label="Identity" density="compact" hide-details />
      <v-select v-model="framework" :items="frameworkOptions" label="Framework" density="compact" hide-details />
      <v-select v-model="layer" :items="layerOptions" label="Layer" density="compact" hide-details />
      <v-select v-model="lifecycle" :items="lifecycleOptions" label="Lifecycle" density="compact" hide-details />
      <v-select v-model="execution" :items="executionOptions" label="Execution" density="compact" hide-details />
      <v-select v-model="stability" :items="stabilityOptions" label="Stability" density="compact" hide-details />
      <v-select v-model="sort" :items="sortOptions" label="Sort" density="compact" hide-details />
    </div>
    <EmptyState v-if="!filtered.length" :message="catalogue.length ? 'No test cases match the current filters.' : 'No logical test cases are available in this report.'" />
    <div v-else class="catalogue-table-wrap">
      <v-table density="compact" fixed-header height="680" class="data-table catalogue-table">
        <thead>
          <tr>
            <th scope="col">Case</th><th scope="col">Type</th><th scope="col" :aria-sort="sortKey === 'status' ? sortDirection : undefined"><button class="th-sort" type="button" @click="setTableSort('status')">Status</button></th>
            <th scope="col">Last executed</th><th scope="col">Stability</th><th scope="col" :aria-sort="sortKey === 'duration' ? sortDirection : undefined"><button class="th-sort" type="button" @click="setTableSort('duration')">Duration</button></th>
            <th scope="col">Traceability</th><th scope="col">Implementations</th><th scope="col">Identity</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filtered" :key="item.id" :class="{ 'failed-row': ['failed','broken','blocked','not-run'].includes(item.latestResult?.status ?? '') }">
            <td>
              <router-link :to="testCaseRoute(item.canonicalId)" class="case-title" :title="item.title">{{ item.title }}</router-link>
              <router-link
                v-for="implementation in implementationAliases(item)"
                :key="implementation.technicalId"
                :to="testCaseRoute(item.canonicalId)"
                class="implementation-alias"
              >{{ implementation.title }}</router-link>
              <div class="mono text-caption case-id" :title="item.canonicalId">{{ item.displayId }}</div>
              <div class="chip-row">
                <v-chip v-for="tag in item.tags.slice(0, 2)" :key="tag" size="x-small" variant="outlined" label>{{ tag }}</v-chip>
              </div>
            </td>
            <td><v-chip size="small" variant="tonal" :color="item.type === 'hybrid' ? 'info' : undefined" label>{{ item.type }}</v-chip></td>
            <td><StatusChip :status="item.latestResult?.status ?? 'not-run'" /></td>
            <td>{{ formatDate(item.lastExecutedAt) }}</td>
            <td>
              <span v-if="item.stability.available">{{ item.stability.passRate }}% · {{ item.stability.sampleSize }} executions</span>
              <span v-else class="text-medium-emphasis">Insufficient history · {{ item.stability.sampleSize }} execution{{ item.stability.sampleSize === 1 ? '' : 's' }}</span>
              <v-chip v-if="item.stability.flaky" size="x-small" color="warning" class="ml-1" label>flaky {{ item.stability.flaky }}</v-chip>
            </td>
            <td class="mono">{{ formatDuration(item.duration?.latestMs) }}<small v-if="item.duration" class="duration-source">{{ item.duration.source }}</small></td>
            <td>
              <div class="chip-row">
                <router-link v-for="key in item.requirements.slice(0, 2)" :key="key" :to="requirementRoute(key)" class="trace-link mono">{{ key }}</router-link>
                <v-chip v-for="key in item.defects.slice(0, 2)" :key="key" size="x-small" color="error" variant="outlined" label>{{ key }}</v-chip>
              </div>
            </td>
            <td>{{ item.implementations.length }}<span class="text-medium-emphasis"> variant{{ item.implementations.length === 1 ? '' : 's' }}</span></td>
            <td>
              <v-chip v-if="item.identity.conflict" size="x-small" color="error" prepend-icon="mdi-alert" label>conflicted</v-chip>
              <v-chip v-else size="x-small" :color="item.identity.stable ? 'success' : 'warning'" :prepend-icon="item.identity.stable ? 'mdi-anchor' : 'mdi-alert-outline'" label>{{ item.identity.stable ? 'stable' : 'generated' }}</v-chip>
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatDuration } from "../format";
import { catalogueFor } from "../services/catalogue";
import { requirementRoute, testCaseRoute } from "../services/routes";
import type { Manifest, TestCase, TestCaseCatalogueEntry } from "../types";

const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const search = ref("");
const status = ref("all");
const type = ref("all");
const identity = ref("all");
const framework = ref("all");
const layer = ref("all");
const lifecycle = ref("all");
const execution = ref("all");
const stability = ref("all");
const sort = ref("attention");
const view = ref("all");
const sortKey = ref<"status" | "duration">("status");
const sortDirection = ref<"ascending" | "descending">("ascending");
const catalogue = computed(() => catalogueFor(props.manifest, props.tests));
const values = (items: Array<string | undefined>) => ["all", ...new Set(items.filter((item): item is string => Boolean(item)).sort())];
const statusOptions = ["all", "broken", "failed", "blocked", "not-run", "skipped", "passed", "unknown"];
const typeOptions = ["all", "automated", "manual", "hybrid"];
const identityOptions = ["all", "stable", "generated", "conflicted"];
const frameworkOptions = computed(() => values(catalogue.value.flatMap((item) => item.implementations.map((implementation) => implementation.framework))));
const layerOptions = computed(() => values(catalogue.value.flatMap((item) => item.implementations.map((implementation) => implementation.layer))));
const lifecycleOptions = ["all", "draft", "approved", "deprecated"];
const executionOptions = ["all", "executed", "not executed"];
const stabilityOptions = ["all", "available", "unavailable", "flaky"];
const sortOptions = [
  { title: "Attention required", value: "attention" }, { title: "ID", value: "id" },
  { title: "Title", value: "title" }, { title: "Current status", value: "status" },
  { title: "Last executed", value: "executed" }, { title: "Duration", value: "duration" },
  { title: "Stability", value: "stability" }, { title: "Implementations", value: "implementations" }
];
const rank: Record<string, number> = { broken: 0, failed: 1, blocked: 2, "not-run": 3, skipped: 4, unknown: 5, passed: 6 };
const attentionCount = computed(() => catalogue.value.filter((item) => (rank[item.latestResult?.status ?? "not-run"] ?? 9) < 4 || item.identity.conflict).length);
const tabs = computed(() => [
  { value: "all", label: "All", count: props.tests.length },
  { value: "failed", label: "Failed", count: props.tests.filter((item) => item.status === "failed").length },
  { value: "broken", label: "Broken", count: props.tests.filter((item) => item.status === "broken").length },
  { value: "skipped", label: "Skipped", count: props.tests.filter((item) => item.status === "skipped").length },
  { value: "flaky", label: "Retried", count: props.tests.filter((item) => item.retries > 0).length }
]);
const haystack = (item: TestCaseCatalogueEntry) => [
  item.canonicalId, item.title, ...item.requirements, ...item.defects, ...item.tags,
  ...item.implementations.flatMap((implementation) => [implementation.framework, implementation.layer, implementation.source?.file])
].filter(Boolean).join(" ").toLowerCase();
const filtered = computed(() => catalogue.value
  .filter((item) => view.value === "all" || (view.value === "flaky" ? item.stability.flaky > 0 : item.latestResult?.status === view.value))
  .filter((item) => !search.value || haystack(item).includes(search.value.toLowerCase()))
  .filter((item) => status.value === "all" || (item.latestResult?.status ?? "not-run") === status.value)
  .filter((item) => type.value === "all" || item.type === type.value)
  .filter((item) => identity.value === "all" || (identity.value === "conflicted" ? item.identity.conflict : identity.value === "stable" ? item.identity.stable && !item.identity.conflict : !item.identity.stable && !item.identity.conflict))
  .filter((item) => framework.value === "all" || item.implementations.some((implementation) => implementation.framework === framework.value))
  .filter((item) => layer.value === "all" || item.implementations.some((implementation) => implementation.layer === layer.value))
  .filter((item) => lifecycle.value === "all" || item.lifecycleStatus === lifecycle.value)
  .filter((item) => execution.value === "all" || (execution.value === "executed") === Boolean(item.lastExecutedAt))
  .filter((item) => stability.value === "all" || (stability.value === "available" ? item.stability.available : stability.value === "unavailable" ? !item.stability.available : item.stability.flaky > 0))
  .sort(compare));
function compare(a: TestCaseCatalogueEntry, b: TestCaseCatalogueEntry) {
  if (sortKey.value === "duration") {
    const result = (a.duration?.latestMs ?? -1) - (b.duration?.latestMs ?? -1);
    return (sortDirection.value === "ascending" ? result : -result) || a.canonicalId.localeCompare(b.canonicalId);
  }
  const tie = a.canonicalId.localeCompare(b.canonicalId);
  if (sort.value === "id") return tie;
  if (sort.value === "title") return a.title.localeCompare(b.title) || tie;
  if (sort.value === "executed") return Date.parse(b.lastExecutedAt ?? "0") - Date.parse(a.lastExecutedAt ?? "0") || tie;
  if (sort.value === "duration") return (b.duration?.latestMs ?? -1) - (a.duration?.latestMs ?? -1) || tie;
  if (sort.value === "stability") return (b.stability.passRate ?? -1) - (a.stability.passRate ?? -1) || tie;
  if (sort.value === "implementations") return b.implementations.length - a.implementations.length || tie;
  const severity = (rank[a.latestResult?.status ?? "not-run"] ?? 9) - (rank[b.latestResult?.status ?? "not-run"] ?? 9);
  return (a.identity.conflict === b.identity.conflict ? 0 : a.identity.conflict ? -1 : 1) || severity || tie;
}
function setTableSort(key: "status" | "duration") {
  if (sortKey.value === key) sortDirection.value = sortDirection.value === "ascending" ? "descending" : "ascending";
  else {
    sortKey.value = key;
    sortDirection.value = key === "duration" ? "descending" : "ascending";
  }
}
function implementationAliases(item: TestCaseCatalogueEntry) {
  return item.implementations.filter((implementation) => implementation.title !== item.title);
}
function formatDate(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Not executed";
}
</script>
