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
    <section class="summary-strip">
      <div>
        <div class="page-kicker">Requirement coverage</div>
        <div class="summary-number">{{ formatPercent(manifest.requirements.percentage) }}</div>
      </div>
      <div class="inline-metrics">
        <div><strong>{{ manifest.requirements.expected.length }}</strong><span>Expected</span></div>
        <div><strong class="text-success">{{ manifest.requirements.covered.length }}</strong><span>Covered</span></div>
        <div><strong class="text-error">{{ manifest.requirements.missing.length }}</strong><span>Missing</span></div>
        <div><strong class="text-warning">{{ manifest.requirements.extra.length }}</strong><span>Extra</span></div>
      </div>
    </section>
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
            <strong class="mr-2">{{ manifest.requirements.testsByRequirement[key]?.length ?? 0 }}</strong>
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
