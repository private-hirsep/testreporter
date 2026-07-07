<template>
  <div v-if="manifest">
    <h1>Dashboard</h1>
    <div class="metrics">
      <MetricCard label="Quality Gate" :value="manifest.qualityGate.status.toUpperCase()" />
      <MetricCard label="Tests" :value="manifest.summary.tests.total" />
      <MetricCard label="Failed" :value="manifest.summary.tests.failed" />
      <MetricCard label="Broken" :value="manifest.summary.tests.broken" />
      <MetricCard label="Coverage" :value="`${manifest.summary.coverage.totalPercentage ?? 'n/a'}%`" />
      <MetricCard label="Requirements" :value="`${manifest.requirements.percentage}%`" />
      <MetricCard label="Critical Security" :value="manifest.summary.security.critical ?? 0" />
      <MetricCard label="High Security" :value="manifest.summary.security.high ?? 0" />
    </div>
    <v-row>
      <v-col cols="12" md="6">
        <v-card border variant="flat">
          <v-card-title>Layer Split</v-card-title>
          <v-table density="compact">
            <tbody>
              <tr v-for="(count, layer) in manifest.summary.tests.byLayer" :key="layer">
                <td>{{ layer }}</td>
                <td class="text-right">{{ count }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card border variant="flat">
          <v-card-title>Run Metadata</v-card-title>
          <v-table density="compact">
            <tbody>
              <tr><td>Generated</td><td>{{ manifest.metadata.generatedAt }}</td></tr>
              <tr><td>Branch</td><td>{{ manifest.metadata.branch ?? "n/a" }}</td></tr>
              <tr><td>Commit</td><td>{{ manifest.metadata.commitSha ?? "n/a" }}</td></tr>
              <tr><td>Run</td><td>{{ manifest.metadata.runId ?? "n/a" }}</td></tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>
    </v-row>
    <v-alert v-if="manifest.warnings.length" type="warning" variant="tonal" class="mt-4">
      {{ manifest.warnings.length }} parser warning(s) or skipped malformed input(s) were recorded.
      Review the Downloads page for details.
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import MetricCard from "../components/MetricCard.vue";
import type { Manifest, TestCase } from "../types";
defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
</script>
