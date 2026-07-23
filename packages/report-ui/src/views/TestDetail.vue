<template>
  <div v-if="item" class="test-detail">
    <v-btn to="/tests" variant="text" prepend-icon="mdi-arrow-left" class="mb-2">Back to Tests</v-btn>
    <PageHeader :title="item.title" :subtitle="item.canonicalId">
      <StatusChip :status="item.latestResult?.status ?? 'not-run'" size="default" />
    </PageHeader>
    <v-alert v-if="item.identity.conflict" type="error" variant="tonal" prominent class="mb-4">
      <strong>Conflicted canonical identity.</strong> Every implementation is preserved, but reliable long-term continuity cannot be claimed.
      <v-btn to="/diagnostics" variant="text" size="small">Open diagnostics</v-btn>
    </v-alert>
    <v-alert v-else-if="!item.identity.stable" type="warning" variant="tonal" class="mb-4">
      Generated identity: this case is usable in the current report but may not remain stable after renames or source moves.
    </v-alert>
    <v-tabs v-model="tab" class="detail-tabs" aria-label="Test case detail sections">
      <v-tab value="overview">Overview</v-tab><v-tab value="implementations">Implementations</v-tab>
      <v-tab value="executions">Executions</v-tab><v-tab value="traceability">Traceability</v-tab>
      <v-tab value="history">Definition history</v-tab><v-tab value="evidence">Evidence</v-tab>
    </v-tabs>
    <v-window v-model="tab" class="mt-4">
      <v-window-item value="overview">
        <section class="portal-card detail-section"><h2>Logical test case</h2>
          <dl class="detail-list">
            <dt>Canonical ID</dt><dd class="mono">{{ item.canonicalId }}</dd>
            <dt>Type</dt><dd><v-chip size="small" variant="tonal" label>{{ item.type }}</v-chip></dd>
            <dt>Identity</dt><dd>{{ item.identity.source }} · {{ item.identity.stable ? "stable" : "unstable" }}{{ item.identity.conflict ? " · conflicted" : "" }}</dd>
            <dt>Lifecycle</dt><dd>{{ item.lifecycleStatus ?? "not defined" }}</dd>
            <dt>Current result</dt><dd><StatusChip :status="item.latestResult?.status ?? 'not-run'" /> <span class="text-medium-emphasis">{{ item.latestResult?.contributingStatuses.join(", ") }}</span></dd>
            <dt>Last executed</dt><dd>{{ formatDate(item.lastExecutedAt) }}</dd>
            <dt>Stability</dt><dd>{{ stabilityLabel }}</dd>
            <dt>Duration</dt><dd>{{ formatDuration(item.duration?.latestMs) }}<span v-if="item.duration"> · {{ item.duration.sampleSize }} {{ item.duration.source }} sample(s), average {{ formatDuration(item.duration.averageMs) }}</span></dd>
            <dt>Requirements</dt><dd>{{ item.requirements.join(", ") || "none" }}</dd>
            <dt>Defects</dt><dd>{{ item.defects.join(", ") || "none" }}</dd>
            <dt>Retries</dt><dd>{{ item.stability.flaky ? `${item.stability.flaky} retried passing result(s)` : "0" }}</dd>
            <dt>Attachments</dt><dd>{{ item.evidence?.references.join(", ") || "none" }}</dd>
            <dt>Tags</dt><dd>{{ item.tags.join(", ") || "none" }}</dd>
            <dt>Variants</dt><dd>{{ item.implementations.map((implementation) => variant(implementation.variant)).filter((value) => value !== "n/a").join(" · ") || "none" }}</dd>
          </dl>
        </section>
        <section v-if="errorTest" class="portal-card detail-section mt-4">
          <h2>Failure Details</h2>
          <v-alert type="error" variant="tonal" class="mb-3">{{ errorTest.error?.message }}</v-alert>
          <pre class="trace-block">{{ errorTest.error?.message }}{{ "\n" }}{{ errorTest.error?.trace }}</pre>
          <h2 v-if="stackFrames.length" class="mt-5">Parsed Stack Frames</h2>
          <v-table v-if="stackFrames.length" density="compact">
            <thead><tr><th scope="col">Function</th><th scope="col">Location</th></tr></thead>
            <tbody><tr v-for="frame in stackFrames" :key="`${frame.fn}-${frame.location}`"><td class="mono">{{ frame.fn }}</td><td class="mono">{{ frame.location }}</td></tr></tbody>
          </v-table>
        </section>
        <section class="portal-card detail-section mt-4">
          <h2>Execution History</h2>
          <p>This report contains {{ executions.length }} current or imported execution(s) for this case. Open the Executions tab for details.</p>
        </section>
        <section class="portal-card detail-section mt-4">
          <h2>Definition History</h2>
          <p>Confidence: <strong>{{ item.definitionHistory?.[0]?.confidence ?? "unavailable" }}</strong>. Open the Definition history tab for revisions.</p>
        </section>
      </v-window-item>
      <v-window-item value="implementations">
        <section class="portal-card detail-section"><h2>Implementations and variants</h2>
          <div class="table-scroll"><v-table density="compact" class="data-table"><thead><tr><th scope="col">Technical ID</th><th scope="col">Kind</th><th scope="col">Framework / layer</th><th scope="col">Source / suite</th><th scope="col">Variant</th><th scope="col">Current result</th><th scope="col">Duration</th></tr></thead>
            <tbody><tr v-for="implementation in item.implementations" :key="implementation.technicalId">
              <td class="mono">{{ implementation.technicalId }}</td><td>{{ implementation.kind }}<span v-if="!implementation.active"> · inactive</span></td>
              <td>{{ implementation.framework ?? "n/a" }} / {{ implementation.layer ?? "n/a" }}</td>
              <td class="mono">{{ source(implementation) }}<div>{{ implementation.suitePath?.join(" › ") }}</div></td>
              <td>{{ variant(implementation.variant) }}</td><td><StatusChip :status="implementation.latestResult?.status ?? 'not-run'" /></td>
              <td class="mono">{{ formatDuration(implementation.latestResult?.durationMs) }}</td>
            </tr></tbody></v-table></div>
        </section>
      </v-window-item>
      <v-window-item value="executions">
        <section class="portal-card detail-section"><h2>Available executions</h2>
          <EmptyState v-if="!executions.length" message="No unified execution in this report contains this case." />
          <v-table v-else density="compact"><thead><tr><th scope="col">Execution</th><th scope="col">Type</th><th scope="col">Result</th><th scope="col">Release / environment</th><th scope="col">Time</th><th scope="col">Duration</th></tr></thead>
            <tbody><tr v-for="execution in executions" :key="execution.id"><td><router-link :to="executionRoute(execution.id)" class="mono">{{ execution.id }}</router-link></td><td>{{ execution.type }}</td><td><StatusChip :status="executionCaseStatus(execution)" /></td><td>{{ execution.release ?? "n/a" }} / {{ execution.environment ?? "n/a" }}</td><td>{{ executionTime(execution) }}</td><td>{{ formatDuration(execution.durationMs) }}<span v-if="execution.testDurationSumMs"> · summed test time {{ formatDuration(execution.testDurationSumMs) }}</span></td></tr></tbody></v-table>
        </section>
      </v-window-item>
      <v-window-item value="traceability">
        <section class="portal-card detail-section"><h2>Traceability</h2>
          <h3>Requirements</h3><div class="chip-row"><router-link v-for="key in item.requirements" :key="key" :to="requirementRoute(key)" class="trace-link mono">{{ key }}</router-link><span v-if="!item.requirements.length">none</span></div>
          <h3 class="mt-4">Defects</h3><div class="chip-row"><v-chip v-for="key in item.defects" :key="key" color="error" size="small" variant="outlined" label>{{ key }}</v-chip><span v-if="!item.defects.length">none</span></div>
          <h3 class="mt-4">Participation</h3><p>{{ item.type }} verification across {{ item.implementations.length }} implementation(s).</p>
        </section>
      </v-window-item>
      <v-window-item value="history">
        <section class="portal-card detail-section"><h2>Definition history</h2>
          <EmptyState v-if="!item.definitionHistory?.length" message="Definition history was not collected or is unavailable." />
          <div v-for="(history, index) in item.definitionHistory ?? []" :key="index" class="mb-4"><p>Confidence: <strong>{{ history?.confidence }}</strong> · {{ history?.sourcePath ?? "source unavailable" }}</p>
            <v-table v-if="history?.revisions.length" density="compact"><thead><tr><th scope="col">Date</th><th scope="col">Author</th><th scope="col">Commit</th><th scope="col">Message</th></tr></thead><tbody><tr v-for="revision in history.revisions" :key="revision.hash"><td>{{ revision.date }}</td><td>{{ revision.author }}</td><td class="mono">{{ revision.hash.slice(0, 8) }}</td><td>{{ revision.message }}</td></tr></tbody></v-table>
          </div>
        </section>
      </v-window-item>
      <v-window-item value="evidence">
        <section class="portal-card detail-section"><h2>Evidence</h2>
          <p>{{ item.evidence?.attachmentCount ?? 0 }} evidence reference(s) belong to this case.</p>
          <ul v-if="item.evidence?.references.length"><li v-for="reference in item.evidence.references" :key="reference" class="mono">{{ reference }}</li></ul>
          <v-btn :to="evidenceRoute()" variant="text" append-icon="mdi-arrow-right">Open Evidence</v-btn>
        </section>
      </v-window-item>
    </v-window>
  </div>
  <v-alert v-else type="warning" variant="tonal">Logical test case was not found. The link may target a newer report or an unavailable legacy result.</v-alert>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatDuration } from "../format";
import { catalogueFor, executionsFor } from "../services/catalogue";
import { evidenceRoute, executionRoute, requirementRoute } from "../services/routes";
import type { Manifest, TestCase, TestCaseImplementation, UnifiedExecution } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const route = useRoute();
const tab = ref("overview");
const catalogue = computed(() => catalogueFor(props.manifest, props.tests));
const routeId = computed(() => String(route.params.id ?? ""));
const item = computed(() => catalogue.value.find((entry) => entry.canonicalId === routeId.value || entry.id === routeId.value || entry.implementations.some((implementation) => implementation.technicalId === routeId.value)));
const executions = computed(() => executionsFor(props.manifest).filter((execution) => item.value && execution.testCaseIds.includes(item.value.canonicalId)));
const technicalTests = computed(() => props.tests.filter((test) => item.value?.implementations.some((implementation) => implementation.technicalId === (test.identity?.technicalId ?? test.id))));
const errorTest = computed(() => technicalTests.value.find((test) => test.error?.message || test.error?.trace));
const stackFrames = computed(() => (errorTest.value?.error?.trace ?? "").split(/\r?\n/).map((line) => line.trim()).map((line) => {
  const node = line.match(/^at\s+(.+?)\s+\((.+:\d+:\d+)\)$/);
  if (node) return { fn: node[1] ?? "anonymous", location: node[2] ?? "" };
  const java = line.match(/^at\s+(.+)\((.+:\d+)\)$/);
  if (java) return { fn: java[1] ?? "anonymous", location: java[2] ?? "" };
  const python = line.match(/^File "(.+)", line (\d+), in (.+)$/);
  return python ? { fn: python[3] ?? "module", location: `${python[1]}:${python[2]}` } : undefined;
}).filter((frame): frame is { fn: string; location: string } => Boolean(frame)));
const stabilityLabel = computed(() => item.value?.stability.available ? `${item.value.stability.passRate}% pass rate · ${item.value.stability.sampleSize} executions` : `Insufficient history · ${item.value?.stability.sampleSize ?? 0} execution(s)`);
function formatDate(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Not executed"; }
function source(implementation: TestCaseImplementation) { return implementation.source?.file ? `${implementation.source.file}${implementation.source.line ? `:${implementation.source.line}` : ""}` : "n/a"; }
function variant(value?: Record<string, string>) { return value ? Object.entries(value).map(([key, item]) => `${key}: ${item}`).join(", ") : "n/a"; }
const executionSeverity: Record<string, number> = { broken: 0, failed: 1, blocked: 2, "not-run": 3, skipped: 4, passed: 5, unknown: 6 };
function executionCaseStatus(execution: UnifiedExecution) {
  return execution.caseResults
    .filter((result) => result.testCaseId === item.value?.canonicalId)
    .sort((left, right) => (executionSeverity[left.status] ?? 9) - (executionSeverity[right.status] ?? 9))[0]?.status ?? "unknown";
}
function executionTime(execution: UnifiedExecution) {
  if (execution.completedAt) return formatDate(execution.completedAt);
  if (execution.startedAt) return formatDate(execution.startedAt);
  return execution.reportedAt ? `Report generated ${formatDate(execution.reportedAt)}` : "Unknown";
}
</script>
