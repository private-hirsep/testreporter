<template>
  <div v-if="manifest">
    <h1>History</h1>
    <v-alert type="info" variant="tonal" class="mb-4">
      History storage is prepared in the report data model. Milestone one records the current run only.
    </v-alert>
    <v-table density="compact">
      <thead>
        <tr>
          <th>Generated</th>
          <th>Gate</th>
          <th>Tests</th>
          <th>Failed</th>
          <th>Coverage</th>
          <th>Requirements</th>
          <th>Critical</th>
          <th>High</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="run in manifest.history.runs" :key="run.id">
          <td>{{ run.generatedAt }}</td>
          <td>{{ run.qualityGateStatus }}</td>
          <td>{{ run.testsTotal }}</td>
          <td>{{ run.testsFailed }}</td>
          <td>{{ run.coveragePercentage ?? "n/a" }}%</td>
          <td>{{ run.requirementCoveragePercentage ?? "n/a" }}%</td>
          <td>{{ run.criticalFindings }}</td>
          <td>{{ run.highFindings }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import type { Manifest, TestCase } from "../types";
defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
</script>
