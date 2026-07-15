<template>
  <div v-if="manifest">
    <PageHeader title="Tests" :subtitle="`${filtered.length} of ${tests.length} tests shown`">
      <v-chip
        :color="
          manifest.summary.tests.failed || manifest.summary.tests.broken ? 'error' : 'success'
        "
        label
      >
        {{ manifest.summary.tests.failed + manifest.summary.tests.broken }} attention
      </v-chip>
    </PageHeader>
    <div class="tab-strip" role="tablist" aria-label="Test result filters">
      <v-btn
        v-for="tab in tabs"
        :key="tab.value"
        :variant="view === tab.value ? 'flat' : 'outlined'"
        :color="view === tab.value ? tab.color : undefined"
        size="small"
        @click="view = tab.value"
      >
        {{ tab.label }} {{ tab.count }}
      </v-btn>
    </div>
    <div class="toolbar toolbar-4">
      <v-text-field
        v-model="search"
        label="Search tests"
        density="compact"
        hide-details
        prepend-inner-icon="mdi-magnify"
      />
      <v-select v-model="status" :items="statuses" label="Status" density="compact" hide-details />
      <v-select v-model="layer" :items="layers" label="Layer" density="compact" hide-details />
      <v-select
        v-model="framework"
        :items="frameworks"
        label="Framework"
        density="compact"
        hide-details
      />
    </div>
    <EmptyState v-if="!filtered.length" message="No tests match the current filters." />
    <v-table v-else density="compact" fixed-header height="650" class="data-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key" :aria-sort="ariaSort(column.key)">
            <button
              v-if="column.sortable"
              class="th-sort"
              type="button"
              @click="setSort(column.key)"
            >
              {{ column.label }}
              <v-icon
                v-if="sortKey === column.key"
                size="x-small"
                :icon="sortDir === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down'"
              />
            </button>
            <template v-else>{{ column.label }}</template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="test in filtered"
          :key="test.id"
          :class="{
            'failed-row': test.status === 'failed',
            'broken-row': test.status === 'broken'
          }"
        >
          <td><StatusChip :status="test.status" /></td>
          <td>
            <router-link :to="`/tests/${test.id}`">{{ test.fullName ?? test.name }}</router-link>
            <div class="mono text-caption text-medium-emphasis">
              {{ test.identity?.canonicalId ?? test.id }}
            </div>
          </td>
          <td>
            <v-chip size="small" variant="tonal" label>{{ test.layer }}</v-chip>
          </td>
          <td>
            <v-chip size="small" variant="outlined" label>{{ test.framework }}</v-chip>
          </td>
          <td>
            <span class="mono cell-truncate" :title="sourceLocation(test)">{{
              sourceLocation(test)
            }}</span>
          </td>
          <td class="mono">{{ formatDuration(test.durationMs) }}</td>
          <td>
            <v-chip
              v-for="key in test.requirements.slice(0, 3)"
              :key="key"
              size="x-small"
              class="mr-1 mono"
              label
              :to="`/requirements#requirement-${key}`"
              >{{ key }}</v-chip
            >
            <span v-if="test.requirements.length > 3" class="text-medium-emphasis"
              >+{{ test.requirements.length - 3 }}</span
            >
            <span v-if="!test.requirements.length" class="text-medium-emphasis">none</span>
          </td>
          <td>
            <v-chip
              v-if="test.retries > 0"
              size="x-small"
              color="warning"
              prepend-icon="mdi-repeat"
              label
              >{{ test.retries }}</v-chip
            >
            <span v-else class="text-medium-emphasis">—</span>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatDuration } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const search = ref("");
const status = ref("all");
const layer = ref("all");
const framework = ref("all");
const view = ref("all");
const statuses = ["all", "passed", "failed", "broken", "skipped", "unknown"];
const layers = ["all", "backend", "frontend", "e2e", "unknown"];
const frameworks = computed(() => ["all", ...new Set(props.tests.map((test) => test.framework))]);

type SortKey = "status" | "name" | "layer" | "framework" | "source" | "duration" | "retries";
const sortKey = ref<SortKey>("status");
const sortDir = ref<1 | -1>(1);
const columns: Array<{ key: SortKey | "requirements"; label: string; sortable: boolean }> = [
  { key: "status", label: "Status", sortable: true },
  { key: "name", label: "Name", sortable: true },
  { key: "layer", label: "Layer", sortable: true },
  { key: "framework", label: "Framework", sortable: true },
  { key: "source", label: "Suite / File", sortable: true },
  { key: "duration", label: "Duration", sortable: true },
  { key: "requirements", label: "Requirements", sortable: false },
  { key: "retries", label: "Retries", sortable: true }
];
const statusRank: Record<string, number> = {
  failed: 0,
  broken: 1,
  skipped: 2,
  unknown: 3,
  passed: 4
};

const tabs = computed(() => [
  { value: "all", label: "All", count: props.tests.length, color: "primary" },
  {
    value: "failed",
    label: "Failed",
    count: props.tests.filter((test) => test.status === "failed").length,
    color: "error"
  },
  {
    value: "broken",
    label: "Broken",
    count: props.tests.filter((test) => test.status === "broken").length,
    color: "deep-purple"
  },
  {
    value: "skipped",
    label: "Skipped",
    count: props.tests.filter((test) => test.status === "skipped").length,
    color: "warning"
  },
  { value: "slowest", label: "Slowest", count: Math.min(props.tests.length, 50), color: "primary" },
  {
    value: "flaky",
    label: "Retried",
    count: props.tests.filter((test) => test.retries > 0).length,
    color: "warning"
  }
]);

const filtered = computed(() => {
  const rows = props.tests
    .filter(
      (test) =>
        view.value === "all" ||
        view.value === "slowest" ||
        (view.value === "flaky" ? test.retries > 0 : test.status === view.value)
    )
    .filter((test) => status.value === "all" || test.status === status.value)
    .filter((test) => layer.value === "all" || test.layer === layer.value)
    .filter((test) => framework.value === "all" || test.framework === framework.value)
    .filter((test) =>
      `${test.fullName ?? ""} ${test.name} ${test.identity?.canonicalId ?? test.id} ${test.file ?? ""} ${test.suite ?? ""} ${test.requirements.join(" ")}`
        .toLowerCase()
        .includes(search.value.toLowerCase())
    );
  if (view.value === "slowest") {
    return rows.sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0)).slice(0, 50);
  }
  return rows.sort(compare);
});

function sourceLocation(test: TestCase) {
  if (test.file) return `${test.file}${test.line ? `:${test.line}` : ""}`;
  return test.suite ?? "n/a";
}

function compare(a: TestCase, b: TestCase) {
  const dir = sortDir.value;
  switch (sortKey.value) {
    case "name":
      return dir * (a.fullName ?? a.name).localeCompare(b.fullName ?? b.name);
    case "layer":
      return dir * a.layer.localeCompare(b.layer);
    case "framework":
      return dir * a.framework.localeCompare(b.framework);
    case "source":
      return dir * sourceLocation(a).localeCompare(sourceLocation(b));
    case "duration":
      return dir * ((a.durationMs ?? 0) - (b.durationMs ?? 0));
    case "retries":
      return dir * (a.retries - b.retries);
    default: {
      const rankDiff = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
      return dir * (rankDiff || (b.durationMs ?? 0) - (a.durationMs ?? 0));
    }
  }
}

function setSort(key: SortKey | "requirements") {
  if (key === "requirements") return;
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 1 ? -1 : 1;
  } else {
    sortKey.value = key;
    sortDir.value = key === "duration" || key === "retries" ? -1 : 1;
  }
}

function ariaSort(key: SortKey | "requirements") {
  if (key !== sortKey.value) return undefined;
  return sortDir.value === 1 ? "ascending" : "descending";
}
</script>
