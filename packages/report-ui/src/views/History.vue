<template>
  <div v-if="manifest">
    <PageHeader
      title="Executions"
      subtitle="Execution results recorded in this report — automated runs and imported manual executions"
    >
      <StatusChip :status="manifest.qualityGate.status" />
    </PageHeader>
    <v-alert v-if="runs.length <= 1" type="info" variant="tonal" class="mb-4">
      Only the current run is available in this report. Historical execution trends are not merged
      into static reports yet.
    </v-alert>
    <SectionCard title="Current automated run" class="mb-4">
      <div class="metric-card-items">
        <div>
          <strong>{{ generatedDate }}</strong
          ><span>Generated</span>
        </div>
        <div>
          <strong>{{ manifest.summary.tests.total }}</strong
          ><span>Tests</span>
        </div>
        <div>
          <strong :class="manifest.summary.tests.failed ? 'text-error' : 'text-success'">{{
            manifest.summary.tests.failed
          }}</strong
          ><span>Failed</span>
        </div>
        <div>
          <strong>{{ formatPercent(manifest.summary.coverage.totalPercentage) }}</strong
          ><span>Coverage</span>
        </div>
        <div>
          <strong>{{ formatPercent(manifest.requirements.percentage) }}</strong
          ><span>Requirements</span>
        </div>
        <div>
          <strong :class="securityTotal ? 'text-error' : 'text-success'">{{ securityTotal }}</strong
          ><span>Security findings</span>
        </div>
      </div>
      <div class="mt-2">
        <v-btn to="/tests" size="small" variant="text" append-icon="mdi-arrow-right"
          >Open test cases</v-btn
        >
      </div>
    </SectionCard>
    <SectionCard
      v-if="runs.length > 1"
      title="Recorded runs"
      description="Runs included in this report's history data"
      class="mb-4"
      flush
    >
      <v-table density="compact" class="data-table">
        <thead>
          <tr>
            <th scope="col">Generated</th>
            <th scope="col">Quality gate</th>
            <th scope="col">Tests</th>
            <th scope="col">Failed</th>
            <th scope="col">Coverage</th>
            <th scope="col">Requirements</th>
            <th scope="col">Critical / high findings</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.id">
            <td>{{ new Date(run.generatedAt).toLocaleString() }}</td>
            <td><StatusChip :status="run.qualityGateStatus" size="x-small" /></td>
            <td>{{ run.testsTotal }}</td>
            <td :class="run.testsFailed ? 'text-error' : ''">{{ run.testsFailed }}</td>
            <td>{{ formatPercent(run.coveragePercentage) }}</td>
            <td>{{ formatPercent(run.requirementCoveragePercentage) }}</td>
            <td>{{ run.criticalFindings + run.highFindings }}</td>
          </tr>
        </tbody>
      </v-table>
    </SectionCard>
    <SectionCard
      title="Imported manual executions"
      description="Completed manual execution results imported as official report data"
    >
      <template #actions>
        <v-btn to="/manual" size="small" variant="text" append-icon="mdi-arrow-right"
          >Manual testing</v-btn
        >
      </template>
      <ul v-if="manifest.manualExecutions.length" class="linked-list">
        <li v-for="run in manifest.manualExecutions" :key="run.executionId">
          <StatusChip :status="run.state" size="x-small" />
          <span class="linked-list-label"
            >{{ run.executionId }} — {{ run.tester }} · {{ run.environment }} · build
            {{ run.testedBuild }} · {{ run.cases.length }} case result(s)</span
          >
        </li>
      </ul>
      <EmptyState v-else message="No completed manual executions were imported for this report." />
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import SectionCard from "../components/SectionCard.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatPercent } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const runs = computed(() => props.manifest?.history?.runs ?? []);
const generatedDate = computed(() =>
  props.manifest ? new Date(props.manifest.metadata.generatedAt).toLocaleDateString() : "n/a"
);
const securityTotal = computed(() =>
  Object.values(props.manifest?.summary.security ?? {}).reduce((sum, value) => sum + value, 0)
);
</script>
