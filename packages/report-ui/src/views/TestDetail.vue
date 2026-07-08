<template>
  <div v-if="test" class="test-detail">
    <v-btn to="/tests" variant="text" prepend-icon="mdi-arrow-left" class="mb-2">Back to tests</v-btn>
    <PageHeader :title="test.name" :subtitle="test.suite ?? 'No suite'">
      <StatusChip :status="test.status" size="default" />
    </PageHeader>
    <div class="detail-grid">
      <section class="portal-card detail-section">
        <h2>Overview</h2>
        <dl class="detail-list">
          <dt>Full Name</dt><dd>{{ test.fullName ?? test.name }}</dd>
          <dt>Status</dt><dd><StatusChip :status="test.status" /></dd>
          <dt>Framework</dt><dd><v-chip size="small" variant="outlined" label>{{ test.framework }}</v-chip></dd>
          <dt>Layer</dt><dd><v-chip size="small" variant="tonal" label>{{ test.layer }}</v-chip></dd>
          <dt>Duration</dt><dd class="mono">{{ formatDuration(test.durationMs) }}</dd>
          <dt>Retries</dt>
          <dd>
            <v-chip v-if="test.retries > 0" size="small" color="warning" prepend-icon="mdi-repeat" label>{{ test.retries }}</v-chip>
            <span v-else>0</span>
          </dd>
        </dl>
      </section>
      <section class="portal-card detail-section">
        <h2>Source &amp; Artifacts</h2>
        <dl class="detail-list">
          <dt>Test File</dt><dd class="mono">{{ test.file ?? "n/a" }}<span v-if="test.line">:{{ test.line }}</span></dd>
          <dt>Result Artifact</dt>
          <dd>
            <a v-if="rawArtifact" :href="rawArtifact.path" target="_blank" rel="noopener" class="mono">{{ test.sourcePath }}</a>
            <span v-else class="mono">{{ test.sourcePath ?? "n/a" }}</span>
          </dd>
          <dt>Attachments</dt>
          <dd>
            <v-chip
              v-for="attachment in test.attachments ?? []"
              :key="`${attachment.name}-${attachment.path}`"
              size="small"
              class="mr-1 mb-1"
              prepend-icon="mdi-paperclip"
              label
            >
              {{ attachment.name }} · {{ attachment.path }}
            </v-chip>
            <span v-if="!(test.attachments?.length)">none</span>
          </dd>
          <dt>Per-Test Coverage</dt><dd>Not available in this report. Enable per-test coverage collection to populate this later.</dd>
        </dl>
      </section>
      <section class="portal-card detail-section">
        <h2>Requirements &amp; Metadata</h2>
        <dl class="detail-list">
          <dt>Requirements</dt>
          <dd>
            <v-chip v-for="key in test.requirements" :key="key" size="small" class="mr-1 mb-1 mono" label :to="`/requirements#requirement-${key}`">{{ key }}</v-chip>
            <span v-if="!test.requirements.length">none</span>
          </dd>
          <dt>Labels</dt>
          <dd>
            <v-chip v-for="label in labels" :key="label" size="small" class="mr-1 mb-1 mono" variant="outlined" label>{{ label }}</v-chip>
            <span v-if="!labels.length">none</span>
          </dd>
        </dl>
      </section>
    </div>
    <section v-if="test.error?.message || test.error?.trace" class="portal-card detail-section">
      <div class="portal-card-title pa-0 mb-2">
        <h2>Failure Details</h2>
        <v-btn size="small" variant="text" prepend-icon="mdi-content-copy" @click="copyError">
          {{ copied ? "Copied" : "Copy error text" }}
        </v-btn>
      </div>
      <v-alert v-if="test.error?.message" type="error" variant="tonal" class="mb-3">{{ test.error.message }}</v-alert>
      <pre class="trace-block">{{ test.error.message }}{{ "\n" }}{{ test.error.trace }}</pre>
      <template v-if="stackFrames.length">
        <h2 class="mt-5 mb-2">Parsed Stack Frames</h2>
        <v-table density="compact" class="data-table">
          <thead><tr><th>Function</th><th>Location</th></tr></thead>
          <tbody>
            <tr v-for="frame in stackFrames" :key="`${frame.fn}-${frame.location}`">
              <td class="mono">{{ frame.fn }}</td>
              <td class="mono">{{ frame.location }}</td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </section>
  </div>
  <v-alert v-else type="warning" variant="tonal">Test case was not found in the loaded chunks.</v-alert>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import PageHeader from "../components/PageHeader.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatDuration } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const route = useRoute();
const copied = ref(false);
const test = computed(() => props.tests.find((item) => item.id === route.params.id));
const rawArtifact = computed(() =>
  props.manifest?.downloads.find(
    (download) => download.category === "tests" && download.sourcePath === test.value?.sourcePath
  )
);
const labels = computed(() =>
  Object.entries(test.value?.labels ?? {}).flatMap(([name, values]) => values.map((value) => `${name}: ${value}`))
);
const stackFrames = computed(() => {
  const trace = test.value?.error?.trace ?? "";
  return trace
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const nodeFrame = line.match(/^at\s+(.+?)\s+\((.+:\d+:\d+)\)$/);
      if (nodeFrame) return { fn: nodeFrame[1] ?? "anonymous", location: nodeFrame[2] ?? "" };
      const javaFrame = line.match(/^at\s+(.+)\((.+:\d+)\)$/);
      if (javaFrame) return { fn: javaFrame[1] ?? "anonymous", location: javaFrame[2] ?? "" };
      const pythonFrame = line.match(/^File "(.+)", line (\d+), in (.+)$/);
      if (pythonFrame) return { fn: pythonFrame[3] ?? "module", location: `${pythonFrame[1]}:${pythonFrame[2]}` };
      return undefined;
    })
    .filter((frame): frame is { fn: string; location: string } => Boolean(frame));
});

async function copyError() {
  const text = [test.value?.error?.message, test.value?.error?.trace].filter(Boolean).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // Clipboard access can be unavailable in insecure contexts; the trace stays selectable.
  }
}
</script>
