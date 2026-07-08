<template>
  <div v-if="manifest">
    <div class="page-heading">
      <div>
        <h1>Tests</h1>
        <div class="page-kicker">{{ filtered.length }} of {{ tests.length }} tests shown</div>
      </div>
      <v-chip :color="manifest.summary.tests.failed || manifest.summary.tests.broken ? 'error' : 'success'" label>
        {{ manifest.summary.tests.failed + manifest.summary.tests.broken }} attention
      </v-chip>
    </div>
    <div class="tab-strip" role="tablist" aria-label="Test result filters">
      <v-btn v-for="tab in tabs" :key="tab.value" :variant="view === tab.value ? 'flat' : 'outlined'" :color="view === tab.value ? tab.color : undefined" size="small" @click="view = tab.value">
        {{ tab.label }} {{ tab.count }}
      </v-btn>
    </div>
    <div class="toolbar">
      <v-text-field v-model="search" label="Search tests" density="compact" hide-details prepend-inner-icon="mdi-magnify" />
      <v-select v-model="status" :items="statuses" label="Status" density="compact" hide-details />
      <v-select v-model="layer" :items="layers" label="Layer" density="compact" hide-details />
    </div>
    <div v-if="!filtered.length" class="empty-state">No tests match the current filters.</div>
    <v-table v-else density="compact" fixed-header height="650" class="data-table">
      <thead>
        <tr>
          <th>Name</th><th>Status</th><th>Layer</th><th>Framework</th><th>Duration</th><th>Requirements</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="test in filtered" :key="test.id" :class="{ 'failed-row': test.status === 'failed', 'broken-row': test.status === 'broken' }">
          <td><router-link :to="`/tests/${test.id}`">{{ test.fullName ?? test.name }}</router-link></td>
          <td><v-chip size="small" :color="statusColor(test.status)" label>{{ test.status }}</v-chip></td>
          <td><v-chip size="small" variant="tonal" label>{{ test.layer }}</v-chip></td>
          <td><v-chip size="small" variant="outlined" label>{{ test.framework }}</v-chip></td>
          <td class="mono">{{ formatDuration(test.durationMs) }}</td>
          <td>
            <v-chip v-for="key in test.requirements" :key="key" size="x-small" class="mr-1 mono" label :to="`/requirements#requirement-${key}`">{{ key }}</v-chip>
            <span v-if="!test.requirements.length" class="text-medium-emphasis">none</span>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { formatDuration, statusColor } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const search = ref("");
const status = ref("all");
const layer = ref("all");
const view = ref("all");
const statuses = ["all", "passed", "failed", "broken", "skipped", "unknown"];
const layers = ["all", "backend", "frontend", "e2e", "unknown"];
const tabs = computed(() => [
  { value: "all", label: "All", count: props.tests.length, color: "primary" },
  { value: "failed", label: "Failed", count: props.tests.filter((test) => test.status === "failed").length, color: "error" },
  { value: "broken", label: "Broken", count: props.tests.filter((test) => test.status === "broken").length, color: "deep-purple" },
  { value: "skipped", label: "Skipped", count: props.tests.filter((test) => test.status === "skipped").length, color: "warning" },
  { value: "slowest", label: "Slowest", count: Math.min(props.tests.length, 50), color: "primary" },
  { value: "flaky", label: "Retried", count: props.tests.filter((test) => test.retries > 0).length, color: "warning" }
]);
const filtered = computed(() =>
  props.tests
    .filter((test) => view.value === "all" || view.value === "slowest" || (view.value === "flaky" ? test.retries > 0 : test.status === view.value))
    .filter((test) => status.value === "all" || test.status === status.value)
    .filter((test) => layer.value === "all" || test.layer === layer.value)
    .filter((test) =>
      `${test.fullName ?? ""} ${test.name} ${test.file ?? ""} ${test.requirements.join(" ")}`
        .toLowerCase()
        .includes(search.value.toLowerCase())
    )
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, view.value === "slowest" ? 50 : props.tests.length)
);
</script>
