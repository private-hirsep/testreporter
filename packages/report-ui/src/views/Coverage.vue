<template>
  <div v-if="manifest">
    <PageHeader title="Coverage" subtitle="Backend, frontend, and file-level coverage from static artifacts" />
    <section class="summary-strip">
      <div>
        <div class="page-kicker">Total coverage</div>
        <div class="summary-number">{{ formatPercent(manifest.summary.coverage.totalPercentage) }}</div>
        <v-chip v-if="lowCoverageFiles.length" color="warning" label class="mt-3">{{ lowCoverageFiles.length }} low coverage file(s)</v-chip>
      </div>
      <div>
        <ProgressMetric
          v-for="item in coverageBreakdown"
          :key="item.label"
          :label="item.label"
          :percent="item.value ?? 0"
          :display="formatPercent(item.value)"
          :tone="coverageClass(item.value)"
        />
      </div>
    </section>
    <section v-if="lowCoverageFiles.length" class="portal-card low-coverage-panel mb-4">
      <div class="portal-card-title">
        <h2>Low Coverage Files</h2>
        <span class="page-kicker">below {{ LOW_COVERAGE_THRESHOLD }}% line coverage</span>
      </div>
      <v-table density="compact" class="data-table">
        <thead><tr><th>Layer</th><th>File</th><th>Lines</th><th>Branches</th></tr></thead>
        <tbody>
          <tr v-for="entry in lowCoverageFiles" :key="`${entry.layer}-${entry.file.path}`" class="failed-row">
            <td><v-chip size="small" variant="tonal" label>{{ entry.layer }}</v-chip></td>
            <td class="mono wrap-anywhere">{{ entry.file.path }}</td>
            <td>{{ formatPercent(entry.file.lines?.percentage) }}</td>
            <td>{{ formatPercent(entry.file.branches?.percentage) }}</td>
          </tr>
        </tbody>
      </v-table>
    </section>
    <EmptyState v-if="!manifest.coverage.length" message="No coverage artifacts were parsed for this run." />
    <v-expansion-panels v-else variant="accordion">
      <v-expansion-panel v-for="item in manifest.coverage" :key="item.layer" class="portal-card">
        <v-expansion-panel-title>
          <strong class="text-capitalize">{{ item.layer }} coverage</strong>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="metric-rows">
            <ProgressMetric
              v-for="metric in metricsFor(item)"
              :key="metric.label"
              :label="metric.label"
              :percent="metric.value ?? 0"
              :display="formatPercent(metric.value)"
              :tone="coverageClass(metric.value)"
            />
          </div>
          <div v-if="item.rawLinks?.length" class="mb-4">
            <v-chip v-for="link in item.rawLinks" :key="link" class="mr-2 mb-2" prepend-icon="mdi-file-chart" :href="link" target="_blank" rel="noopener" label>
              Raw coverage report
            </v-chip>
          </div>
          <v-table v-if="item.files?.length" density="compact" class="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Package</th>
                <th :aria-sort="fileSortDir[item.layer] === -1 ? 'descending' : 'ascending'">
                  <button class="th-sort" type="button" @click="toggleFileSort(item.layer)">
                    Lines
                    <v-icon size="x-small" :icon="fileSortDir[item.layer] === -1 ? 'mdi-arrow-down' : 'mdi-arrow-up'" />
                  </button>
                </th>
                <th>Branches</th>
                <th>Functions / Methods</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in sortedFiles(item)" :key="file.path" :class="{ 'failed-row': (file.lines?.percentage ?? 100) < LOW_COVERAGE_THRESHOLD }">
                <td class="mono">{{ file.path }}</td>
                <td>{{ file.packageName ?? "n/a" }}</td>
                <td>{{ formatPercent(file.lines?.percentage) }}</td>
                <td>{{ formatPercent(file.branches?.percentage) }}</td>
                <td>{{ formatPercent(file.functions?.percentage ?? file.methods?.percentage) }}</td>
              </tr>
            </tbody>
          </v-table>
          <EmptyState v-else message="No file-level coverage is available for this layer." />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import ProgressMetric from "../components/ProgressMetric.vue";
import { formatPercent } from "../format";
import type { CoverageFile, CoverageSummary, Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();

const LOW_COVERAGE_THRESHOLD = 70;
const fileSortDir = reactive<Record<string, 1 | -1>>({});

const coverageBreakdown = computed(() => [
  { label: "Total", value: props.manifest?.summary.coverage.totalPercentage },
  { label: "Backend", value: props.manifest?.summary.coverage.backendPercentage },
  { label: "Frontend", value: props.manifest?.summary.coverage.frontendPercentage }
]);
const lowCoverageFiles = computed(() =>
  (props.manifest?.coverage ?? [])
    .flatMap((item) => (item.files ?? []).map((file) => ({ layer: item.layer, file })))
    .filter((entry) => (entry.file.lines?.percentage ?? 100) < LOW_COVERAGE_THRESHOLD)
    .sort((a, b) => (a.file.lines?.percentage ?? 100) - (b.file.lines?.percentage ?? 100))
);

function metricsFor(item: CoverageSummary) {
  return [
    { label: "Lines", value: item.lines?.percentage },
    { label: "Branches", value: item.branches?.percentage },
    { label: "Functions", value: item.functions?.percentage ?? item.methods?.percentage },
    { label: "Statements", value: item.statements?.percentage ?? item.instructions?.percentage }
  ].filter((metric) => metric.value !== undefined);
}

function sortedFiles(item: CoverageSummary): CoverageFile[] {
  const dir = fileSortDir[item.layer] ?? 1;
  return [...(item.files ?? [])].sort(
    (a, b) => dir * ((a.lines?.percentage ?? 100) - (b.lines?.percentage ?? 100))
  );
}

function toggleFileSort(layer: string) {
  fileSortDir[layer] = (fileSortDir[layer] ?? 1) === 1 ? -1 : 1;
}

function coverageClass(value?: number) {
  if (value === undefined) return "medium";
  if (value < LOW_COVERAGE_THRESHOLD) return "low";
  if (value < 85) return "medium";
  return "";
}
</script>
