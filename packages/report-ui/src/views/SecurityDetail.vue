<template>
  <div v-if="finding">
    <h1>{{ finding.title }}</h1>
    <v-card border variant="flat">
      <v-card-text>
        <v-chip :color="severityColor(finding.severity)" label>{{ finding.severity }}</v-chip>
        <dl class="detail-list">
          <dt>Tool</dt><dd>{{ finding.tool }}</dd>
          <dt>Rule ID</dt><dd>{{ finding.ruleId ?? "n/a" }}</dd>
          <dt>File</dt><dd>{{ finding.file ?? "n/a" }}<span v-if="finding.line">:{{ finding.line }}</span></dd>
          <dt>URL</dt><dd>{{ finding.url ?? "n/a" }}</dd>
          <dt>Raw report</dt>
          <dd>
            <a v-if="rawReport" :href="rawReport.path" target="_blank" rel="noopener">{{ rawReport.name }}</a>
            <span v-else>n/a</span>
          </dd>
        </dl>
        <pre v-if="finding.message">{{ finding.message }}</pre>
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
const finding = computed(() => props.manifest?.security.find((item) => item.id === route.params.id));
const rawReport = computed(() =>
  props.manifest?.downloads.find(
    (download) => download.category === "security" && download.sourcePath === finding.value?.sourcePath
  )
);

function severityColor(severity: string) {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  if (severity === "low") return "info";
  return "default";
}
</script>
