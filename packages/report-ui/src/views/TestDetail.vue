<template>
  <div v-if="test">
    <div class="page-heading">
      <div>
        <v-btn to="/tests" variant="text" prepend-icon="mdi-arrow-left" class="mb-2">Back to tests</v-btn>
        <h1>{{ test.name }}</h1>
        <div class="page-kicker">{{ test.suite ?? "No suite" }}</div>
      </div>
      <v-chip :color="statusColor(test.status)" label>{{ test.status }}</v-chip>
    </div>
    <v-card class="portal-card" variant="flat">
      <v-card-text>
        <dl class="detail-list">
          <dt>Full Name</dt><dd>{{ test.fullName ?? test.name }}</dd>
          <dt>Suite</dt><dd>{{ test.suite ?? "n/a" }}</dd>
          <dt>Result Artifact</dt><dd class="mono">{{ test.sourcePath ?? "n/a" }}</dd>
          <dt>File</dt><dd class="mono">{{ test.file ?? "n/a" }}<span v-if="test.line">:{{ test.line }}</span></dd>
          <dt>Framework</dt><dd><v-chip size="small" variant="outlined" label>{{ test.framework }}</v-chip></dd>
          <dt>Layer</dt><dd><v-chip size="small" variant="tonal" label>{{ test.layer }}</v-chip></dd>
          <dt>Duration</dt><dd class="mono">{{ formatDuration(test.durationMs) }}</dd>
          <dt>Retries</dt><dd>{{ test.retries }}</dd>
          <dt>Requirements</dt>
          <dd>
            <v-chip v-for="key in test.requirements" :key="key" size="small" class="mr-1 mono" label :to="`/requirements#requirement-${key}`">{{ key }}</v-chip>
            <span v-if="!test.requirements.length">none</span>
          </dd>
          <dt>Metadata</dt>
          <dd>
            <v-chip v-for="label in labels" :key="label" size="small" class="mr-1 mb-1 mono" variant="outlined" label>{{ label }}</v-chip>
            <span v-if="!labels.length">none</span>
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
        <template v-if="test.error?.message || test.error?.trace">
          <h2 class="mb-2">Failure Details</h2>
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
        </template>
      </v-card-text>
    </v-card>
  </div>
  <v-alert v-else type="warning" variant="tonal">Test case was not found in the loaded chunks.</v-alert>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { formatDuration, statusColor } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const route = useRoute();
const test = computed(() => props.tests.find((item) => item.id === route.params.id));
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
</script>
