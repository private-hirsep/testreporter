<template>
  <PageHeader
    title="Manual testing"
    subtitle="Definitions and imported results are official report data; runner drafts stay only in this browser."
  />
  <v-tabs v-model="tab"
    ><v-tab value="cases">Manual Cases</v-tab><v-tab value="executions">Manual Executions</v-tab
    ><v-tab value="runner">Manual Runner</v-tab></v-tabs
  >
  <v-window v-model="tab" class="mt-4">
    <v-window-item value="cases"
      ><v-row
        ><v-col v-for="item in manifest?.manualCases ?? []" :key="item.id" cols="12"
          ><v-card :title="`${item.id} — ${item.title}`"
            ><v-card-subtitle
              >{{ item.status }} · {{ item.priority }} priority · {{ item.risk }} risk ·
              {{ item.estimatedMinutes ?? "—" }} min</v-card-subtitle
            ><v-card-text
              ><p>{{ item.description }}</p>
              <p><strong>Requirements:</strong> {{ item.requirements.join(", ") || "None" }}</p>
              <p><strong>Tags:</strong> {{ item.tags.join(", ") || "None" }}</p>
              <ol>
                <li v-for="step in item.steps" :key="step.action">
                  <strong>{{ step.action }}</strong
                  ><br />Expected: {{ step.expected }}
                </li>
              </ol>
              <small
                >Source: {{ item.sourcePath ?? "n/a" }} · revision
                {{ item.revision ?? "n/a" }}</small
              ></v-card-text
            ><v-card-actions
              ><v-btn @click="start(item.id)">Run case</v-btn></v-card-actions
            ></v-card
          ></v-col
        ></v-row
      ></v-window-item
    >
    <v-window-item value="executions"
      ><v-alert v-if="!manifest?.manualExecutions.length" type="info" variant="tonal"
        >No imported manual executions. Local drafts are not audit evidence.</v-alert
      ><v-card
        v-for="run in manifest?.manualExecutions ?? []"
        :key="run.executionId"
        class="mb-3"
        :title="run.executionId"
        ><v-card-text
          >{{ run.state }} · {{ run.tester }} · {{ run.environment }} · build {{ run.testedBuild
          }}<br />{{ run.cases.length }} case result(s)</v-card-text
        ></v-card
      ></v-window-item
    >
    <v-window-item value="runner"
      ><v-alert type="warning" variant="tonal" class="mb-3"
        >This is unsaved local work until exported, committed or added to CI artifacts, and imported
        by the CLI.</v-alert
      ><v-card v-if="currentCase && draft" :title="`${currentCase.id} — ${currentCase.title}`"
        ><v-card-text
          ><p>{{ completed }} completed · {{ draft.cases.length - completed }} remaining</p>
          <div v-for="(step, index) in currentCase.steps" :key="index" class="mb-4">
            <strong>{{ index + 1 }}. {{ step.action }}</strong>
            <p>Expected: {{ step.expected }}</p>
            <v-btn-toggle
              v-model="currentResult.steps[index]!.status"
              mandatory
              @update:model-value="save"
              ><v-btn v-for="status in statuses" :key="status" :value="status">{{
                status
              }}</v-btn></v-btn-toggle
            >
          </div>
          <v-select
            v-model="currentResult.status"
            data-testid="case-status"
            :items="statuses.filter((s) => s !== 'not-run')"
            label="Case result"
            @update:model-value="save" /><v-textarea
            v-model="currentResult.actualResult"
            label="Actual result"
            @update:model-value="save" /><v-textarea
            v-model="currentResult.notes"
            label="Notes"
            @update:model-value="save" /><v-text-field
            :model-value="currentResult.defects.join(', ')"
            label="Defect references (comma-separated)"
            @update:model-value="
              (v) => {
                currentResult.defects = split(v);
                save();
              }
            " /><v-text-field
            :model-value="currentResult.evidence.join(', ')"
            label="Evidence filenames/references"
            @update:model-value="
              (v) => {
                currentResult.evidence = split(v);
                save();
              }
            " /></v-card-text
        ><v-card-actions
          ><v-btn :disabled="position === 0" @click="position--">Previous</v-btn
          ><v-btn @click="next">Save and next</v-btn
          ><v-btn color="primary" @click="exportResult">Export validated JSON</v-btn
          ><v-btn color="error" variant="text" @click="discard"
            >Discard draft</v-btn
          ></v-card-actions
        ></v-card
      ><v-alert v-else type="info" variant="tonal"
        >Choose “Run case” from Manual Cases. Existing browser drafts are restored
        automatically.</v-alert
      ></v-window-item
    >
  </v-window>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageHeader from "../components/PageHeader.vue";
import { draftKey, manualDrafts } from "../services/manualDrafts";
import type { Manifest, ManualExecution, ManualStatus } from "../types";
const props = defineProps<{ manifest?: Manifest }>();
const tab = ref("cases");
const draft = ref<ManualExecution>();
const position = ref(0);
const statuses: ManualStatus[] = ["not-run", "passed", "failed", "blocked", "skipped"];
const currentResult = computed(() => draft.value!.cases[position.value]!);
const currentCase = computed(() =>
  props.manifest?.manualCases.find((c) => c.id === currentResult.value?.caseId)
);
const completed = computed(
  () => draft.value?.cases.filter((c) => c.status !== "not-run").length ?? 0
);
function split(v: unknown) {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function save() {
  if (draft.value) manualDrafts.save(draft.value);
}
function start(id: string) {
  const cases = props.manifest?.manualCases ?? [];
  const existing = manualDrafts.list()[0]?.value;
  draft.value = existing ?? {
    schemaVersion: "1.0",
    executionId: `manual-${props.manifest?.metadata.runId ?? "local"}`,
    projectKey: props.manifest?.metadata.projectName ?? "project",
    release: props.manifest?.metadata.runId,
    testedBuild: props.manifest?.metadata.commitSha ?? "local-build",
    environment: "local",
    tester: "local tester",
    startedAt: new Date().toISOString(),
    state: "draft",
    cases: cases.map((c) => ({
      caseId: c.id,
      caseRevision: c.revision,
      status: "not-run",
      steps: c.steps.map((_, index) => ({ index, status: "not-run", evidence: [] })),
      defects: [],
      evidence: []
    }))
  };
  position.value = Math.max(
    0,
    draft.value.cases.findIndex((c) => c.caseId === id)
  );
  save();
  tab.value = "runner";
}
function next() {
  save();
  if (draft.value && position.value < draft.value.cases.length - 1) position.value++;
}
function discard() {
  if (draft.value) manualDrafts.remove(draftKey(draft.value));
  draft.value = undefined;
}
function exportResult() {
  if (!draft.value) return;
  if (draft.value.cases.some((c) => c.status === "not-run")) {
    alert("Complete or skip every case before export.");
    return;
  }
  draft.value.state = "completed";
  draft.value.completedAt = new Date().toISOString();
  save();
  const blob = new Blob([JSON.stringify(draft.value, null, 2) + "\n"], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `manual-result-${draft.value.projectKey}-${draft.value.executionId}.json`.replace(
    /[^a-z0-9._-]/gi,
    "-"
  );
  a.click();
  URL.revokeObjectURL(a.href);
}
onMounted(() => {
  const saved = manualDrafts.list()[0]?.value;
  if (saved) {
    draft.value = saved;
    tab.value = "runner";
  }
});
</script>
