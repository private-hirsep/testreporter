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
      <v-select v-model="requirement" :items="requirementOptions" label="Requirement" density="compact" hide-details />
      <v-select v-model="defect" :items="defectOptions" label="Defect" density="compact" hide-details />
      <v-select v-model="tag" :items="tagOptions" label="Tag" density="compact" hide-details />
      <v-select v-model="lifecycle" :items="lifecycleOptions" label="Lifecycle" density="compact" hide-details />
      <v-select v-model="execution" :items="executionOptions" label="Execution" density="compact" hide-details />
      <v-select v-model="stability" :items="stabilityOptions" label="Stability" density="compact" hide-details />
      <v-select v-model="sort" :items="sortOptions" label="Sort" density="compact" hide-details />
      <v-btn variant="outlined" prepend-icon="mdi-filter-remove" @click="resetFilters">Reset filters</v-btn>
    </div>
    <EmptyState v-if="!filtered.length" :message="catalogue.length ? 'No test cases match the current filters.' : 'No logical test cases are available in this report.'" />
    <div v-else class="catalogue-table-wrap">
      <v-table density="compact" fixed-header height="680" class="data-table catalogue-table">
        <thead>
          <tr>
            <th scope="col" :aria-sort="sort === 'title' || sort === 'id' ? sortDirection : undefined"><button class="th-sort" type="button" @click="setTableSort('title')">Title</button><button class="th-sort id-sort" type="button" @click="setTableSort('id')">ID</button></th><th scope="col">Type</th><th scope="col" :aria-sort="sort === 'status' ? sortDirection : undefined"><button class="th-sort" type="button" @click="setTableSort('status')">Status</button></th>
            <th scope="col" :aria-sort="sort === 'executed' ? sortDirection : undefined"><button class="th-sort" type="button" @click="setTableSort('executed')">Last executed</button></th><th scope="col" :aria-sort="sort === 'stability' ? sortDirection : undefined"><button class="th-sort" type="button" @click="setTableSort('stability')">Stability</button></th><th scope="col" :aria-sort="sort === 'duration' ? sortDirection : undefined"><button class="th-sort" type="button" @click="setTableSort('duration')">Duration</button></th>
            <th scope="col">Traceability</th><th scope="col" :aria-sort="sort === 'implementations' ? sortDirection : undefined"><button class="th-sort" type="button" @click="setTableSort('implementations')">Implementations</button></th><th scope="col">Identity</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in paged" :key="item.id" :class="{ 'failed-row': ['failed','broken','blocked','not-run'].includes(item.latestResult?.status ?? '') }">
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
                <v-chip v-for="caseTag in item.tags.slice(0, 2)" :key="caseTag" size="x-small" variant="outlined" label>{{ caseTag }}</v-chip>
              </div>
            </td>
            <td><v-chip size="small" variant="tonal" :color="item.type === 'hybrid' ? 'info' : undefined" label>{{ item.type }}</v-chip></td>
            <td><StatusChip :status="item.latestResult?.status ?? 'not-run'" /></td>
            <td>{{ formatDate(item.lastExecutedAt) }}</td>
            <td>
              <span v-if="item.identity.conflict || item.stability.unavailableReason === 'identity-conflict'" class="text-medium-emphasis">Unavailable · identity conflict</span>
              <span v-else-if="item.stability.available">{{ item.stability.passRate }}% · {{ item.stability.sampleSize }} executions</span>
              <span v-else class="text-medium-emphasis">Insufficient history · {{ item.stability.sampleSize }} execution{{ item.stability.sampleSize === 1 ? '' : 's' }}</span>
              <v-chip v-if="!item.identity.conflict && item.stability.flaky" size="x-small" color="warning" class="ml-1" label>flaky {{ item.stability.flaky }}</v-chip>
            </td>
            <td class="mono">{{ item.duration?.latestMs !== undefined ? formatDuration(item.duration.latestMs) : item.duration ? "Latest not available" : "Not recorded" }}<small v-if="item.duration" class="duration-source">{{ item.duration.source }}</small></td>
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
      <div class="catalogue-pagination">
        <span>Showing {{ pageStart }}–{{ pageEnd }} of {{ filtered.length }} logical cases</span>
        <v-select v-model="pageSize" :items="[25, 50, 100]" label="Rows per page" density="compact" hide-details />
        <v-pagination v-model="page" :length="pageCount" density="compact" aria-label="Test case catalogue pages" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatDuration } from "../format";
import { catalogueFor } from "../services/catalogue";
import {
  catalogueCounts,
  catalogueOptions,
  catalogueSearchIndex,
  filterCatalogue,
  sortCatalogue,
  type CatalogueFilters,
  type CatalogueSort
} from "../services/catalogueView";
import { requirementRoute, testCaseRoute } from "../services/routes";
import type { Manifest, TestCase, TestCaseCatalogueEntry } from "../types";

const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const search = ref("");
const status = ref("all");
const type = ref("all");
const identity = ref("all");
const framework = ref("all");
const layer = ref("all");
const requirement = ref("all");
const defect = ref("all");
const tag = ref("all");
const lifecycle = ref("all");
const execution = ref("all");
const stability = ref("all");
const sort = ref("status");
const view = ref("all");
const sortDirection = ref<"ascending" | "descending">("ascending");
const page = ref(1);
const pageSize = ref(50);
const catalogue = computed(() => catalogueFor(props.manifest, props.tests));
const options = computed(() => catalogueOptions(catalogue.value));
const counts = computed(() => catalogueCounts(catalogue.value));
const searchIndex = computed(() => catalogueSearchIndex(catalogue.value));
const statusOptions = ["all", "broken", "failed", "blocked", "not-run", "skipped", "passed", "unknown"];
const typeOptions = ["all", "automated", "manual", "hybrid"];
const identityOptions = ["all", "stable", "generated", "conflicted"];
const frameworkOptions = computed(() => options.value.frameworks);
const layerOptions = computed(() => options.value.layers);
const requirementOptions = computed(() => options.value.requirements);
const defectOptions = computed(() => options.value.defects);
const tagOptions = computed(() => options.value.tags);
const lifecycleOptions = ["all", "draft", "approved", "deprecated"];
const executionOptions = ["all", "executed", "not executed"];
const stabilityOptions = ["all", "available", "unavailable", "flaky"];
const sortOptions = [
  { title: "Attention required", value: "attention" }, { title: "ID", value: "id" },
  { title: "Title", value: "title" }, { title: "Current status", value: "status" },
  { title: "Last executed", value: "executed" }, { title: "Duration", value: "duration" },
  { title: "Stability", value: "stability" }, { title: "Implementations", value: "implementations" }
];
const attentionCount = computed(() => counts.value.broken + counts.value.failed + counts.value.blocked + counts.value.notRun + counts.value.conflicted);
const tabs = computed(() => [
  { value: "all", label: "All", count: counts.value.all },
  { value: "failed", label: "Failed", count: counts.value.failed },
  { value: "broken", label: "Broken", count: counts.value.broken },
  { value: "blocked", label: "Blocked", count: counts.value.blocked },
  { value: "not-run", label: "Not run", count: counts.value.notRun },
  { value: "skipped", label: "Skipped", count: counts.value.skipped },
  { value: "flaky", label: "Retried", count: counts.value.flaky },
  { value: "slowest", label: "Slowest", count: counts.value.slowest }
]);
const filters = computed<CatalogueFilters>(() => ({
  search: search.value,
  quick: view.value,
  status: status.value,
  type: type.value,
  identity: identity.value,
  framework: framework.value,
  layer: layer.value,
  requirement: requirement.value,
  defect: defect.value,
  tag: tag.value,
  lifecycle: lifecycle.value,
  execution: execution.value,
  stability: stability.value
}));
const filtered = computed(() => {
  const rows = filterCatalogue(catalogue.value, filters.value, searchIndex.value);
  if (view.value === "slowest")
    return sortCatalogue(rows, "duration", "descending").slice(0, 10);
  return sortCatalogue(rows, sort.value as CatalogueSort, sortDirection.value);
});
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)));
const pageStart = computed(() => filtered.value.length ? (page.value - 1) * pageSize.value + 1 : 0);
const pageEnd = computed(() => Math.min(page.value * pageSize.value, filtered.value.length));
const paged = computed(() => filtered.value.slice(pageStart.value ? pageStart.value - 1 : 0, pageEnd.value));
function setTableSort(key: CatalogueSort) {
  if (sort.value === key) sortDirection.value = sortDirection.value === "ascending" ? "descending" : "ascending";
  else {
    sort.value = key;
    sortDirection.value = "descending";
  }
}
function resetFilters() {
  search.value = ""; status.value = "all"; type.value = "all"; identity.value = "all";
  framework.value = "all"; layer.value = "all"; requirement.value = "all"; defect.value = "all";
  tag.value = "all"; lifecycle.value = "all"; execution.value = "all"; stability.value = "all";
  view.value = "all"; page.value = 1;
}
function implementationAliases(item: TestCaseCatalogueEntry) {
  return item.implementations.filter((implementation) => implementation.title !== item.title);
}
function formatDate(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Not executed";
}
watch([filters, pageSize], () => { page.value = 1; });
watch(pageCount, (count) => { if (page.value > count) page.value = count; });
</script>
