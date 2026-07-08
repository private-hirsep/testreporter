<template>
  <div v-if="finding">
    <h1>{{ finding.title }}</h1>
    <v-card border variant="flat">
      <v-card-text>
        <v-chip :color="severityColor(finding.severity)" label>{{ finding.severity }}</v-chip>
        <dl class="detail-list">
          <dt>Tool</dt><dd>{{ finding.tool }}</dd>
          <dt>Rule ID</dt><dd>{{ finding.ruleId ?? "n/a" }}</dd>
          <dt>Precision</dt><dd>{{ finding.precision ?? "n/a" }}</dd>
          <dt>Tags</dt><dd>{{ finding.tags.join(", ") || "n/a" }}</dd>
          <dt>Confidence</dt><dd>{{ finding.confidence ?? "n/a" }}</dd>
          <dt>Risk Code</dt><dd>{{ finding.riskCode ?? "n/a" }}</dd>
          <dt>CWE/WASC</dt><dd>{{ ids }}</dd>
          <dt>File</dt><dd>{{ finding.file ?? "n/a" }}<span v-if="finding.line">:{{ finding.line }}</span></dd>
          <dt>URL</dt><dd>{{ finding.url ?? "n/a" }}</dd>
          <dt>Help URI</dt>
          <dd>
            <a v-if="finding.helpUri" :href="finding.helpUri" target="_blank" rel="noopener">{{ finding.helpUri }}</a>
            <span v-else>n/a</span>
          </dd>
          <dt>Raw report</dt>
          <dd>
            <a v-if="rawReport" :href="rawReport.path" target="_blank" rel="noopener">{{ rawReport.name }}</a>
            <span v-else>n/a</span>
          </dd>
        </dl>
        <h2 class="section-heading">Description</h2>
        <pre v-if="finding.description">{{ finding.description }}</pre>
        <p v-else>n/a</p>
        <pre v-if="finding.message">{{ finding.message }}</pre>
        <h2 class="section-heading">Evidence</h2>
        <pre v-if="finding.evidence">{{ finding.evidence }}</pre>
        <p v-else>n/a</p>
        <h2 class="section-heading">Remediation</h2>
        <pre v-if="finding.remediation">{{ finding.remediation }}</pre>
        <p v-else>n/a</p>
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
const ids = computed(() => {
  const parts = [finding.value?.cweId ? `CWE-${finding.value.cweId}` : "", finding.value?.wascId ? `WASC-${finding.value.wascId}` : ""].filter(Boolean);
  return parts.join(", ") || "n/a";
});

function severityColor(severity: string) {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  if (severity === "low") return "info";
  return "default";
}
</script>
