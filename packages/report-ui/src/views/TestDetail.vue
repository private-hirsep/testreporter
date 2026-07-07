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
          <dt>Suite</dt><dd>{{ test.suite ?? "n/a" }}</dd>
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
        </dl>
        <template v-if="test.error?.message || test.error?.trace">
          <h2 class="mb-2">Failure Details</h2>
          <pre class="trace-block">{{ test.error.message }}{{ "\n" }}{{ test.error.trace }}</pre>
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
</script>
