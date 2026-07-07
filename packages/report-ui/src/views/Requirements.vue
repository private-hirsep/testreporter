<template>
  <div v-if="manifest">
    <div class="page-heading">
      <div>
        <h1>Requirement Coverage</h1>
        <div class="page-kicker">{{ filteredKeys.length }} of {{ allKeys.length }} requirements shown</div>
      </div>
      <v-chip :color="manifest.requirements.missing.length ? 'warning' : 'success'" label>
        {{ formatPercent(manifest.requirements.percentage) }} covered
      </v-chip>
    </div>
    <div class="metrics">
      <MetricCard label="Coverage" :value="formatPercent(manifest.requirements.percentage)" :tone="manifest.requirements.missing.length ? 'warn' : 'pass'" />
      <MetricCard label="Expected" :value="manifest.requirements.expected.length" />
      <MetricCard label="Covered" :value="manifest.requirements.covered.length" tone="pass" />
      <MetricCard label="Missing" :value="manifest.requirements.missing.length" :tone="manifest.requirements.missing.length ? 'fail' : 'pass'" />
      <MetricCard label="Extra" :value="manifest.requirements.extra.length" :tone="manifest.requirements.extra.length ? 'warn' : 'neutral'" />
    </div>
    <div class="toolbar">
      <v-text-field v-model="search" label="Search requirements" density="compact" hide-details prepend-inner-icon="mdi-magnify" />
      <v-select v-model="filter" :items="['all', 'covered', 'missing', 'extra']" label="Status" density="compact" hide-details />
      <div />
    </div>
    <v-table density="compact" class="data-table">
      <thead><tr><th>Requirement</th><th>Status</th><th>Tests</th></tr></thead>
      <tbody>
        <tr v-for="key in filteredKeys" :id="`requirement-${key}`" :key="key" :class="{ 'failed-row': status(key) === 'missing' }">
          <td class="mono">{{ key }}</td>
          <td><v-chip size="small" :color="statusColor(status(key))" label>{{ status(key) }}</v-chip></td>
          <td>
            <v-chip
              v-for="testId in manifest.requirements.testsByRequirement[key] ?? []"
              :key="testId"
              size="x-small"
              class="mr-1 mono"
              label
              :to="`/tests/${testId}`"
            >
              {{ testName(testId) }}
            </v-chip>
            <span v-if="!(manifest.requirements.testsByRequirement[key]?.length)" class="text-medium-emphasis">none</span>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MetricCard from "../components/MetricCard.vue";
import { formatPercent, statusColor } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const search = ref("");
const filter = ref("all");
const allKeys = computed(() =>
  props.manifest ? [...new Set([...props.manifest.requirements.expected, ...props.manifest.requirements.extra])].sort() : []
);
const filteredKeys = computed(() =>
  allKeys.value
    .filter((key) => filter.value === "all" || status(key) === filter.value)
    .filter((key) => key.toLowerCase().includes(search.value.toLowerCase()))
);
function status(key: string) {
  if (props.manifest?.requirements.missing.includes(key)) return "missing";
  if (props.manifest?.requirements.extra.includes(key)) return "extra";
  return "covered";
}
function testName(id: string) {
  return props.tests.find((test) => test.id === id)?.name ?? id;
}
</script>
