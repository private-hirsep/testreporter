<template>
  <div v-if="manifest">
    <h1>Tests</h1>
    <v-tabs v-model="tab" density="compact" class="mb-4">
      <v-tab value="all">All</v-tab>
      <v-tab value="failed">Failed</v-tab>
      <v-tab value="skipped">Skipped</v-tab>
      <v-tab value="broken">Broken</v-tab>
      <v-tab value="slowest">Slowest</v-tab>
      <v-tab value="retried">Retried/Flaky</v-tab>
    </v-tabs>
    <div class="toolbar">
      <v-text-field v-model="search" label="Search tests" density="compact" hide-details prepend-inner-icon="mdi-magnify" />
      <v-select v-model="status" :items="statuses" label="Status" density="compact" hide-details />
      <v-select v-model="layer" :items="layers" label="Layer" density="compact" hide-details />
    </div>
    <v-table density="compact" fixed-header height="650">
      <thead>
        <tr>
          <th>Name</th><th>Status</th><th>Layer</th><th>Framework</th><th>Duration</th><th>Requirements</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="test in filtered" :key="test.id">
          <td><router-link :to="`/tests/${test.id}`">{{ test.fullName ?? test.name }}</router-link></td>
          <td><v-chip size="small" :color="color(test.status)" label>{{ test.status }}</v-chip></td>
          <td>{{ test.layer }}</td>
          <td>{{ test.framework }}</td>
          <td>{{ test.durationMs ?? 0 }} ms</td>
          <td>{{ test.requirements.join(", ") }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const tab = ref("all");
const search = ref("");
const status = ref("all");
const layer = ref("all");
const statuses = ["all", "passed", "failed", "broken", "skipped", "unknown"];
const layers = ["all", "backend", "frontend", "e2e", "unknown"];
const filtered = computed(() =>
  props.tests
    .filter((test) => {
      if (tab.value === "failed") return test.status === "failed";
      if (tab.value === "skipped") return test.status === "skipped";
      if (tab.value === "broken") return test.status === "broken";
      if (tab.value === "retried") return test.retries > 0;
      return true;
    })
    .filter((test) => status.value === "all" || test.status === status.value)
    .filter((test) => layer.value === "all" || test.layer === layer.value)
    .filter((test) => `${test.fullName ?? ""} ${test.name} ${test.file ?? ""}`.toLowerCase().includes(search.value.toLowerCase()))
    .toSorted((a, b) =>
      tab.value === "slowest"
        ? (b.durationMs ?? 0) - (a.durationMs ?? 0)
        : (a.fullName ?? a.name).localeCompare(b.fullName ?? b.name)
    )
);
function color(value: string) {
  return value === "passed" ? "success" : value === "failed" || value === "broken" ? "error" : "warning";
}
</script>
