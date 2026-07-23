<template>
  <div v-if="execution">
    <v-btn to="/history" variant="text" prepend-icon="mdi-arrow-left" class="mb-2">Back to executions</v-btn>
    <PageHeader :title="execution.id" :subtitle="`${execution.type} execution`"><StatusChip :status="execution.status" /></PageHeader>
    <div class="detail-grid">
      <section class="portal-card detail-section"><h2>Execution metadata</h2><dl class="detail-list">
        <dt>Project</dt><dd>{{ execution.project }}</dd><dt>Release</dt><dd>{{ execution.release ?? "n/a" }}</dd>
        <dt>Branch</dt><dd>{{ execution.branch ?? "n/a" }}</dd><dt>Environment</dt><dd>{{ execution.environment ?? "n/a" }}</dd>
        <dt>Commit</dt><dd class="mono">{{ execution.commit ?? "n/a" }}</dd><dt>Workflow run</dt><dd>{{ execution.workflowRun ?? "n/a" }}</dd>
        <dt>Started</dt><dd>{{ formatDate(execution.startedAt) }}</dd><dt>Completed</dt><dd>{{ formatDate(execution.completedAt) }}</dd>
        <dt>Report generated</dt><dd>{{ formatDate(execution.reportedAt) }}</dd>
        <dt>Wall-clock duration</dt><dd>{{ formatDuration(execution.durationMs) }}</dd>
        <dt>Summed test time</dt><dd>{{ formatDuration(execution.testDurationSumMs) }}</dd><dt>Tester</dt><dd>{{ execution.tester ?? "n/a" }}</dd>
        <dt>Tested build</dt><dd>{{ execution.testedBuild ?? "n/a" }}</dd><dt>Source report</dt><dd>{{ execution.sourceReport ?? "n/a" }}</dd>
      </dl></section>
      <section class="portal-card detail-section"><h2>Result summary</h2><dl class="detail-list">
        <dt>Total</dt><dd>{{ execution.counts.total }}</dd><dt>Passed</dt><dd>{{ execution.counts.passed }}</dd>
        <dt>Failed</dt><dd>{{ execution.counts.failed }}</dd><dt>Broken</dt><dd>{{ execution.counts.broken ?? 0 }}</dd>
        <dt>Blocked</dt><dd>{{ execution.counts.blocked ?? 0 }}</dd><dt>Skipped</dt><dd>{{ execution.counts.skipped ?? 0 }}</dd>
      </dl></section>
    </div>
    <section class="portal-card detail-section mt-4"><h2>Test cases involved</h2>
      <v-alert v-if="!execution.caseResultsAvailable" type="info" variant="tonal" class="mb-3">Execution-specific case results are unavailable in this older report.</v-alert>
      <v-table v-else density="compact"><thead><tr><th scope="col">ID</th><th scope="col">Title</th><th scope="col">Result</th></tr></thead><tbody>
        <tr v-for="(result, index) in execution.caseResults" :key="`${result.testCaseId}-${result.implementationId ?? index}`">
          <td><router-link :to="testCaseRoute(result.testCaseId)" class="mono">{{ result.testCaseId }}</router-link><div v-if="result.implementationId" class="mono text-caption">{{ result.implementationId }}</div></td>
          <td>{{ caseById.get(result.testCaseId)?.title ?? "Case unavailable in this report" }}</td>
          <td><StatusChip :status="result.status" /><div v-if="result.durationMs !== undefined">{{ formatDuration(result.durationMs) }}</div><div v-if="result.notes?.length">{{ result.notes.join(" · ") }}</div></td>
        </tr>
      </tbody></v-table>
    </section>
    <section class="portal-card detail-section mt-4"><h2>Traceability and evidence</h2>
      <p><strong>Requirements:</strong> <router-link v-for="id in execution.requirementIds" :key="id" :to="requirementRoute(id)" class="mr-2 mono">{{ id }}</router-link><span v-if="!execution.requirementIds.length">none</span></p>
      <p><strong>Defects:</strong> {{ execution.defectIds.join(", ") || "none" }}</p>
      <p><strong>Evidence:</strong> {{ execution.evidence?.complete ? "complete" : "incomplete" }} · {{ execution.evidence?.referenceCount ?? 0 }} reference(s)</p>
      <ul v-if="evidenceReferences.length"><li v-for="reference in evidenceReferences" :key="reference" class="mono">{{ reference }}</li></ul>
      <p v-else class="text-medium-emphasis">No execution-specific evidence references are available.</p>
      <v-btn :to="evidenceRoute()" variant="text" append-icon="mdi-arrow-right">Open evidence</v-btn>
      <p v-if="execution.notes?.length"><strong>Manual notes:</strong> {{ execution.notes.join(" · ") }}</p>
    </section>
  </div>
  <v-alert v-else type="warning" variant="tonal">Execution was not found in this report.</v-alert>
</template>
<script setup lang="ts">
import { computed } from "vue"; import { useRoute } from "vue-router";
import PageHeader from "../components/PageHeader.vue"; import StatusChip from "../components/StatusChip.vue"; import { formatDuration } from "../format";
import { catalogueFor, executionsFor } from "../services/catalogue"; import { evidenceRoute, requirementRoute, testCaseRoute } from "../services/routes";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>(); const route = useRoute();
const execution = computed(() => executionsFor(props.manifest).find((item) => item.id === String(route.params.id ?? "")));
const caseById = computed(() => new Map(catalogueFor(props.manifest, props.tests).map((item) => [item.canonicalId,item])));
const evidenceReferences = computed(() => [...new Set(execution.value?.caseResults.flatMap((result) => result.evidenceReferences ?? []) ?? [])]);
function formatDate(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Unknown"; }
</script>
