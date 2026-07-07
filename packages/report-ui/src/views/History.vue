<template>
  <div v-if="manifest">
    <div class="page-heading">
      <div>
        <h1>History</h1>
        <div class="page-kicker">Current-run summary prepared for future history merging</div>
      </div>
      <v-chip :color="gateColor(manifest.qualityGate.status)" label>{{ manifest.qualityGate.status }}</v-chip>
    </div>
    <v-alert type="info" variant="tonal" class="mb-4">
      Historical trend merging is not enabled for this static report yet. This page shows the current run without inventing prior data.
    </v-alert>
    <div class="metrics">
      <MetricCard label="Generated" :value="generatedDate" />
      <MetricCard label="Tests" :value="manifest.summary.tests.total" />
      <MetricCard label="Coverage" :value="formatPercent(manifest.summary.coverage.totalPercentage)" />
      <MetricCard label="Requirements" :value="formatPercent(manifest.requirements.percentage)" />
      <MetricCard label="Security Findings" :value="securityTotal" :tone="securityTotal ? 'fail' : 'pass'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MetricCard from "../components/MetricCard.vue";
import { formatPercent, gateColor } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const generatedDate = computed(() => (props.manifest ? new Date(props.manifest.metadata.generatedAt).toLocaleDateString() : "n/a"));
const securityTotal = computed(() => Object.values(props.manifest?.summary.security ?? {}).reduce((sum, value) => sum + value, 0));
</script>
