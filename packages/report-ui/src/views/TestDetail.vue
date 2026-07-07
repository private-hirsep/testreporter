<template>
  <div v-if="test">
    <h1>{{ test.name }}</h1>
    <v-card border variant="flat">
      <v-card-text>
        <v-chip :color="test.status === 'passed' ? 'success' : 'error'" label>{{ test.status }}</v-chip>
        <dl class="detail-list">
          <dt>Suite</dt><dd>{{ test.suite ?? "n/a" }}</dd>
          <dt>File</dt><dd>{{ test.file ?? "n/a" }}<span v-if="test.line">:{{ test.line }}</span></dd>
          <dt>Framework</dt><dd>{{ test.framework }}</dd>
          <dt>Layer</dt><dd>{{ test.layer }}</dd>
          <dt>Duration</dt><dd>{{ test.durationMs ?? 0 }} ms</dd>
          <dt>Retries</dt><dd>{{ test.retries }}</dd>
          <dt>Requirements</dt><dd>{{ test.requirements.join(", ") || "none" }}</dd>
        </dl>
        <pre v-if="test.error?.message || test.error?.trace">{{ test.error.message }}{{ "\n" }}{{ test.error.trace }}</pre>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const route = useRoute();
const test = computed(() => props.tests.find((item) => item.id === route.params.id));
</script>
