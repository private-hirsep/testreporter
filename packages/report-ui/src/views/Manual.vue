<template>
  <div>
    <PageHeader
      title="Manual Testing"
      subtitle="Definitions and imported results are official report data; runner drafts stay only in this browser."
    />
    <v-tabs v-model="tab" class="mb-1">
      <v-tab value="cases">Manual Cases</v-tab>
      <v-tab value="executions">Manual Executions</v-tab>
      <v-tab value="runner">Manual Runner</v-tab>
    </v-tabs>
    <v-window v-model="tab" class="mt-4">
      <v-window-item value="cases">
        <EmptyState
          v-if="!manifest?.manualCases.length"
          message="No manual cases are defined in this report. Add Git-tracked case YAML files to the configured manual cases path."
        />
        <v-card
          v-for="item in manifest?.manualCases ?? []"
          :key="item.id"
          class="mb-3 portal-card manual-case"
          variant="flat"
        >
          <div class="manual-case-head">
            <div>
              <h2 class="manual-case-title">{{ item.id }} — {{ item.title }}</h2>
              <div class="manual-case-chips">
                <StatusChip :status="item.status" size="x-small" />
                <v-chip size="x-small" variant="tonal" label>{{ item.priority }} priority</v-chip>
                <v-chip size="x-small" variant="tonal" label>{{ item.risk }} risk</v-chip>
                <v-chip size="x-small" variant="outlined" label
                  >{{ item.estimatedMinutes ?? "—" }} min</v-chip
                >
              </div>
            </div>
            <v-btn
              :disabled="item.status !== 'approved'"
              color="primary"
              variant="flat"
              size="small"
              prepend-icon="mdi-play"
              @click="start(item.id)"
              >Run case</v-btn
            >
          </div>
          <v-card-text class="pt-0">
            <p v-if="item.description">{{ item.description }}</p>
            <p class="mb-1">
              <strong>Requirements:</strong> {{ item.requirements.join(", ") || "None" }}
            </p>
            <p class="mb-2"><strong>Tags:</strong> {{ item.tags.join(", ") || "None" }}</p>
            <v-alert
              v-if="item.status !== 'approved'"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              <strong>Not active:</strong> only approved cases can be executed.
            </v-alert>
            <ol class="manual-steps">
              <li v-for="(step, index) in item.steps" :key="index">
                <strong>{{ step.action }}</strong>
                <div class="manual-step-expected">Expected: {{ step.expected }}</div>
              </li>
            </ol>
            <small class="text-medium-emphasis mono"
              >Source: {{ item.sourcePath ?? "n/a" }} · revision {{ item.revision ?? "n/a" }}</small
            >
          </v-card-text>
        </v-card>
      </v-window-item>
      <v-window-item value="executions">
        <v-alert v-if="!manifest?.manualExecutions.length" type="info" variant="tonal">
          No imported completed manual executions. Local drafts are not audit evidence.
        </v-alert>
        <v-card
          v-for="run in manifest?.manualExecutions ?? []"
          :key="run.executionId"
          class="mb-3 portal-card"
          variant="flat"
        >
          <div class="manual-case-head">
            <div>
              <h2 class="manual-case-title">{{ run.executionId }}</h2>
              <div class="manual-case-chips">
                <StatusChip :status="run.state" size="x-small" />
                <v-chip size="x-small" variant="tonal" label>{{ run.environment }}</v-chip>
                <v-chip size="x-small" variant="outlined" class="mono" label
                  >build {{ run.testedBuild }}</v-chip
                >
              </div>
            </div>
          </div>
          <v-card-text class="pt-0">
            {{ run.tester }} · {{ run.cases.length }} case result(s)
          </v-card-text>
        </v-card>
      </v-window-item>
      <v-window-item value="runner">
        <v-alert type="warning" variant="tonal" class="mb-3">
          This browser-local draft is not official evidence until exported and imported by the CLI.
        </v-alert>
        <v-card v-if="currentCase && draft" class="portal-card" variant="flat">
          <div class="manual-case-head">
            <div>
              <h2 class="manual-case-title">{{ currentCase.id }} — {{ currentCase.title }}</h2>
              <div class="manual-case-chips">
                <StatusChip :status="currentResult.status" size="x-small" />
                <span class="text-medium-emphasis"
                  >Case {{ position + 1 }} of {{ draft.cases.length }}</span
                >
              </div>
            </div>
            <v-btn
              color="primary"
              variant="flat"
              size="small"
              prepend-icon="mdi-export"
              @click="exportResult"
              >Export validated JSON</v-btn
            >
          </div>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6"
                ><v-text-field
                  v-model="draft.executionId"
                  label="Execution ID"
                  density="compact"
                  @change="save"
              /></v-col>
              <v-col cols="12" md="6"
                ><v-text-field
                  v-model="draft.release"
                  label="Release or milestone"
                  density="compact"
                  @change="save"
              /></v-col>
              <v-col cols="12" md="6"
                ><v-text-field
                  v-model="draft.testedBuild"
                  label="Tested build or commit"
                  density="compact"
                  @change="save"
              /></v-col>
              <v-col cols="12" md="6"
                ><v-text-field
                  v-model="draft.environment"
                  label="Environment"
                  density="compact"
                  @change="save"
              /></v-col>
              <v-col cols="12" md="6"
                ><v-text-field
                  v-model="draft.tester"
                  label="Tester"
                  density="compact"
                  @change="save"
              /></v-col>
              <v-col cols="12" md="6"
                ><v-text-field
                  v-model="draft.sourceCommit"
                  label="Manual case source commit"
                  density="compact"
                  @change="save"
              /></v-col>
            </v-row>
            <v-alert v-if="exportErrors.length" type="error" variant="tonal" class="mb-3">{{
              exportErrors.join("; ")
            }}</v-alert>
            <div class="manual-progress">
              <p class="mb-1">{{ completed }} completed · {{ draft.cases.length - completed }} remaining</p>
              <v-progress-linear
                :model-value="(completed / Math.max(draft.cases.length, 1)) * 100"
                color="primary"
                height="6"
                rounded
                aria-label="Manual execution progress"
              />
            </div>
            <div v-for="(step, index) in currentCase.steps" :key="index" class="manual-runner-step">
              <strong>{{ index + 1 }}. {{ step.action }}</strong>
              <p class="manual-step-expected mb-2">Expected: {{ step.expected }}</p>
              <v-btn-toggle
                v-model="currentResult.steps[index]!.status"
                mandatory
                density="compact"
                @update:model-value="syncCaseStatus"
              >
                <v-btn v-for="status in statuses" :key="status" :value="status" size="small">{{
                  status
                }}</v-btn>
              </v-btn-toggle>
            </div>
            <v-select
              v-model="currentResult.status"
              data-testid="case-status"
              :items="caseStatusItems"
              label="Case result"
              density="compact"
              @update:model-value="setCaseStatus"
            />
            <v-textarea
              v-model="currentResult.actualResult"
              label="Actual result"
              rows="2"
              @update:model-value="save"
            />
            <v-textarea
              v-model="currentResult.notes"
              label="Notes"
              rows="2"
              @update:model-value="save"
            />
            <v-text-field
              :model-value="currentResult.defects.join(', ')"
              label="Defect references (comma-separated)"
              density="compact"
              @update:model-value="
                (v) => {
                  currentResult.defects = split(v);
                  save();
                }
              "
            />
            <v-text-field
              :model-value="currentResult.evidence.join(', ')"
              label="Evidence filenames/references"
              density="compact"
              @update:model-value="
                (v) => {
                  currentResult.evidence = split(v);
                  save();
                }
              "
            />
          </v-card-text>
          <v-card-actions>
            <v-btn :disabled="position === 0" @click="position--">Previous</v-btn>
            <v-btn @click="next">Save and next</v-btn>
            <v-spacer />
            <v-btn color="error" variant="text" @click="discard">Discard draft</v-btn>
          </v-card-actions>
        </v-card>
        <v-alert v-else type="info" variant="tonal"
          >Choose “Run case” from an approved Manual Case.</v-alert
        >
      </v-window-item>
    </v-window>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusChip from "../components/StatusChip.vue";
import { manualDrafts, type ManualDraftScope } from "../services/manualDrafts";
import { calculateCaseStatus, validateManualExecution } from "../services/manualValidation";
import type { Manifest, ManualExecution, ManualStatus } from "../types";
const props = defineProps<{ manifest?: Manifest | undefined }>();
const tab = ref("cases");
const draft = ref<ManualExecution>();
const position = ref(0);
const exportErrors = ref<string[]>([]);
const statuses: ManualStatus[] = ["not-run", "passed", "failed", "blocked", "skipped"];
const caseStatusItems = computed<ManualStatus[]>(() =>
  statuses.filter((status) => status !== "not-run")
);
const currentResult = computed(() => draft.value!.cases[position.value]!);
const currentCase = computed(() =>
  props.manifest?.manualCases.find((item) => item.id === currentResult.value?.caseId)
);
const completed = computed(
  () => draft.value?.cases.filter((item) => item.status !== "not-run").length ?? 0
);

function split(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function scope(): ManualDraftScope {
  return {
    project: props.manifest?.metadata.projectName ?? "project",
    reportRun: props.manifest?.metadata.runId ?? "local",
    testedBuild: props.manifest?.metadata.commitSha ?? "local-build"
  };
}

function context() {
  const release = props.manifest?.metadata.runId;
  return {
    executionId: `manual-${props.manifest?.metadata.runId ?? "local"}`,
    projectKey: props.manifest?.metadata.projectName ?? "project",
    ...(release ? { release } : {}),
    testedBuild: props.manifest?.metadata.commitSha ?? "local-build"
  };
}

function save() {
  if (draft.value) manualDrafts.save(scope(), draft.value);
}

function syncCaseStatus() {
  currentResult.value.status = calculateCaseStatus(
    currentResult.value.steps.map((step) => step.status)
  );
  save();
}

function setCaseStatus(status: ManualStatus) {
  currentResult.value.steps.forEach((step) => {
    step.status = status;
  });
  currentResult.value.status = status;
  save();
}

function start(id: string) {
  const cases = (props.manifest?.manualCases ?? []).filter((item) => item.status === "approved");
  const executionContext = context();
  const loaded: ManualExecution = manualDrafts.load(scope()) ?? {
    schemaVersion: "1.0",
    ...executionContext,
    environment: "local",
    tester: "local tester",
    startedAt: new Date().toISOString(),
    state: "draft",
    cases: cases.map((item) => ({
      caseId: item.id,
      ...(item.revision ? { caseRevision: item.revision } : {}),
      status: "not-run" as const,
      steps: item.steps.map((_, index) => ({
        index,
        status: "not-run" as const,
        evidence: []
      })),
      defects: [],
      evidence: []
    }))
  };
  draft.value = loaded;
  position.value = Math.max(
    0,
    loaded.cases.findIndex((item) => item.caseId === id)
  );
  save();
  tab.value = "runner";
}

function next() {
  save();
  if (draft.value && position.value < draft.value.cases.length - 1) position.value++;
}

function discard() {
  manualDrafts.remove(scope());
  draft.value = undefined;
}

function exportResult() {
  if (!draft.value) return;
  draft.value.state = "completed";
  draft.value.completedAt = new Date().toISOString();
  exportErrors.value = validateManualExecution(draft.value, props.manifest?.manualCases ?? []);
  if (exportErrors.value.length) {
    draft.value.state = "draft";
    delete draft.value.completedAt;
    return;
  }
  save();
  const blob = new Blob([JSON.stringify(draft.value, null, 2) + "\n"], {
    type: "application/json"
  });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `manual-result-${draft.value.projectKey}-${draft.value.executionId}.json`.replace(
    /[^a-z0-9._-]/gi,
    "-"
  );
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

watch(
  () => props.manifest,
  (manifest) => {
    if (!manifest) return;
    const saved = manualDrafts.load(scope());
    if (saved) {
      draft.value = saved;
      tab.value = "runner";
    }
  },
  { immediate: true }
);
</script>
