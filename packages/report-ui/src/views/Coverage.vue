<template>
  <div v-if="manifest">
    <div class="page-heading">
      <div>
        <h1>Coverage</h1>
        <div class="page-kicker">Backend, frontend, and file-level coverage from static artifacts</div>
      </div>
    </div>
    <section class="summary-strip">
      <div>
        <div class="page-kicker">Total coverage</div>
        <div class="summary-number">{{ formatPercent(manifest.summary.coverage.totalPercentage) }}</div>
        <v-chip v-if="lowCoverageFiles.length" color="warning" label class="mt-3">{{ lowCoverageFiles.length }} low coverage file(s)</v-chip>
      </div>
      <div>
        <div v-for="item in coverageBreakdown" :key="item.label" class="chart-row">
          <span>{{ item.label }}</span>
          <div class="progress-track"><div class="progress-fill" :class="coverageClass(item.value)" :style="{ width: `${item.value ?? 0}%` }" /></div>
          <strong>{{ formatPercent(item.value) }}</strong>
        </div>
      </div>
    </section>
    <div v-if="!manifest.coverage.length" class="empty-state">No coverage artifacts were parsed for this run.</div>
    <v-expansion-panels v-else variant="accordion">
      <v-expansion-panel v-for="item in manifest.coverage" :key="item.layer" class="portal-card">
        <v-expansion-panel-title>
          <strong class="text-capitalize">{{ item.layer }} coverage</strong>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="chart-grid">
            <v-card v-for="metric in metricsFor(item)" :key="metric.label" class="portal-card" variant="flat">
              <v-card-text>
                <div class="d-flex justify-space-between mb-2"><strong>{{ metric.label }}</strong><span class="mono">{{ formatPercent(metric.value) }}</span></div>
                <div class="progress-track"><div class="progress-fill" :class="coverageClass(metric.value)" :style="{ width: `${metric.value ?? 0}%` }" /></div>
              </v-card-text>
            </v-card>
          </div>
          <div v-if="item.rawLinks?.length" class="mb-4">
            <v-chip v-for="link in item.rawLinks" :key="link" class="mr-2 mb-2" prepend-icon="mdi-file-chart" :href="link" target="_blank" rel="noopener" label>
              Raw coverage report
            </v-chip>
          </div>
          <v-table v-if="item.files?.length" density="compact" class="data-table">
            <thead><tr><th>File</th><th>Package</th><th>Lines</th><th>Branches</th><th>Functions / Methods</th></tr></thead>
            <tbody>
              <tr v-for="file in item.files" :key="file.path" :class="{ 'failed-row': (file.lines?.percentage ?? 100) < 70 }">
                <td class="mono">{{ file.path }}</td>
                <td>{{ file.packageName ?? "n/a" }}</td>
                <td>{{ formatPercent(file.lines?.percentage) }}</td>
                <td>{{ formatPercent(file.branches?.percentage) }}</td>
                <td>{{ formatPercent(file.functions?.percentage ?? file.methods?.percentage) }}</td>
              </tr>
            </tbody>
          </v-table>
          <div v-else class="empty-state">No file-level coverage is available for this layer.</div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatPercent } from "../format";
import type { CoverageSummary, Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();

const coverageBreakdown = computed(() => [
  { label: "Total", value: props.manifest?.summary.coverage.totalPercentage },
  { label: "Backend", value: props.manifest?.summary.coverage.backendPercentage },
  { label: "Frontend", value: props.manifest?.summary.coverage.frontendPercentage }
]);
const lowCoverageFiles = computed(() =>
  (props.manifest?.coverage ?? []).flatMap((item) => item.files ?? []).filter((file) => (file.lines?.percentage ?? 100) < 70)
);

function metricsFor(item: CoverageSummary) {
  return [
    { label: "Lines", value: item.lines?.percentage },
    { label: "Branches", value: item.branches?.percentage },
    { label: "Functions", value: item.functions?.percentage ?? item.methods?.percentage },
    { label: "Statements", value: item.statements?.percentage ?? item.instructions?.percentage }
  ].filter((metric) => metric.value !== undefined);
}

function coverageClass(value?: number) {
  if (value === undefined) return "medium";
  if (value < 70) return "low";
  if (value < 85) return "medium";
  return "";
}

</script>
