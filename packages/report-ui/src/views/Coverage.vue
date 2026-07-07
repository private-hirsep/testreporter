<template>
  <div v-if="manifest">
    <h1>Coverage</h1>
    <div class="metrics">
      <MetricCard label="Total" :value="`${manifest.summary.coverage.totalPercentage ?? 'n/a'}%`" />
      <MetricCard label="Backend" :value="`${manifest.summary.coverage.backendPercentage ?? 'n/a'}%`" />
      <MetricCard label="Frontend" :value="`${manifest.summary.coverage.frontendPercentage ?? 'n/a'}%`" />
    </div>
    <v-expansion-panels variant="accordion">
      <v-expansion-panel v-for="item in manifest.coverage" :key="item.layer">
        <v-expansion-panel-title>{{ item.layer }} coverage</v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="metrics compact">
            <MetricCard label="Lines" :value="formatMetric(item.lines)" />
            <MetricCard label="Branches" :value="formatMetric(item.branches)" />
            <MetricCard label="Instructions" :value="formatMetric(item.instructions)" />
            <MetricCard label="Statements" :value="formatMetric(item.statements)" />
            <MetricCard label="Methods" :value="formatMetric(item.methods ?? item.functions)" />
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Package/File</th>
                <th>Lines</th>
                <th>Branches</th>
                <th>Instructions</th>
                <th>Statements</th>
                <th>Methods/Functions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in item.files" :key="file.path">
                <td>{{ file.path }}</td>
                <td>{{ formatMetric(file.lines) }}</td>
                <td>{{ formatMetric(file.branches) }}</td>
                <td>{{ formatMetric(file.instructions) }}</td>
                <td>{{ formatMetric(file.statements) }}</td>
                <td>{{ formatMetric(file.methods ?? file.functions) }}</td>
              </tr>
              <tr v-if="item.files.length === 0">
                <td colspan="6">No package or file-level coverage was available for this artifact.</td>
              </tr>
            </tbody>
          </v-table>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import MetricCard from "../components/MetricCard.vue";
import type { CoverageMetric, Manifest, TestCase } from "../types";
defineProps<{ manifest?: Manifest; tests: TestCase[] }>();

function formatMetric(metric?: CoverageMetric) {
  if (!metric) return "n/a";
  const pct = metric.percentage !== undefined ? `${metric.percentage}%` : "n/a";
  if (metric.covered !== undefined && metric.total !== undefined) return `${pct} (${metric.covered}/${metric.total})`;
  return pct;
}
</script>
