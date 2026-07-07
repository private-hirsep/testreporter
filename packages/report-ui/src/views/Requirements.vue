<template>
  <div v-if="manifest">
    <h1>Requirement Coverage</h1>
    <div class="metrics">
      <MetricCard label="Coverage" :value="`${manifest.requirements.percentage}%`" />
      <MetricCard label="Expected" :value="manifest.requirements.expected.length" />
      <MetricCard label="Covered" :value="manifest.requirements.covered.length" />
      <MetricCard label="Missing" :value="manifest.requirements.missing.length" />
      <MetricCard label="Extra" :value="manifest.requirements.extra.length" />
    </div>
    <v-table density="compact">
      <thead><tr><th>Requirement</th><th>Status</th><th>Tests</th></tr></thead>
      <tbody>
        <tr v-for="key in allKeys" :id="`requirement-${key}`" :key="key">
          <td>{{ key }}</td>
          <td>{{ status(key) }}</td>
          <td>{{ manifest.requirements.testsByRequirement[key]?.length ?? 0 }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MetricCard from "../components/MetricCard.vue";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const allKeys = computed(() =>
  props.manifest ? [...new Set([...props.manifest.requirements.expected, ...props.manifest.requirements.extra])].sort() : []
);
function status(key: string) {
  if (props.manifest?.requirements.missing.includes(key)) return "missing";
  if (props.manifest?.requirements.extra.includes(key)) return "extra";
  return "covered";
}
</script>
