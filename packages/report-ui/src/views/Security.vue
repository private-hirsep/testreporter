<template>
  <div v-if="manifest">
    <div class="page-heading">
      <div>
        <h1>Security</h1>
        <div class="page-kicker">{{ filtered.length }} of {{ manifest.security.length }} findings shown</div>
      </div>
      <v-chip :color="criticalOrHigh ? 'error' : 'success'" label>
        {{ criticalOrHigh }} critical/high
      </v-chip>
    </div>
    <div class="metrics">
      <MetricCard label="Critical" :value="manifest.summary.security.critical ?? 0" :tone="manifest.summary.security.critical ? 'fail' : 'pass'" />
      <MetricCard label="High" :value="manifest.summary.security.high ?? 0" :tone="manifest.summary.security.high ? 'fail' : 'pass'" />
      <MetricCard label="Medium" :value="manifest.summary.security.medium ?? 0" :tone="manifest.summary.security.medium ? 'warn' : 'pass'" />
      <MetricCard label="Low" :value="manifest.summary.security.low ?? 0" />
      <MetricCard label="Info" :value="manifest.summary.security.info ?? 0" />
    </div>
    <div class="chart-grid">
      <v-card v-for="summary in toolSummaries" :key="summary.tool" class="portal-card" variant="flat">
        <v-card-title class="text-capitalize">{{ summary.tool }} Summary</v-card-title>
        <v-card-text>{{ summary.count }} finding(s)</v-card-text>
      </v-card>
    </div>
    <div class="toolbar">
      <v-text-field v-model="search" label="Search findings" density="compact" hide-details prepend-inner-icon="mdi-magnify" />
      <v-select v-model="severity" :items="['all', 'critical', 'high', 'medium', 'low', 'info', 'unknown']" label="Severity" density="compact" hide-details />
      <v-select v-model="tool" :items="tools" label="Tool" density="compact" hide-details />
    </div>
    <div v-if="!filtered.length" class="empty-state">No security findings match the current filters.</div>
    <v-expansion-panels v-else variant="accordion">
      <v-expansion-panel v-for="finding in filtered" :key="finding.id" class="portal-card">
        <v-expansion-panel-title>
          <div class="d-flex align-center ga-3 flex-wrap">
            <v-chip size="small" :color="severityColor(finding.severity)" label>{{ finding.severity ?? "unknown" }}</v-chip>
            <v-chip size="small" variant="outlined" label>{{ finding.tool ?? "unknown" }}</v-chip>
            <strong>{{ finding.title ?? finding.ruleId ?? finding.id }}</strong>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <dl class="detail-list">
            <dt>Rule ID</dt><dd class="mono">{{ finding.ruleId ?? "n/a" }}</dd>
            <dt>Message</dt><dd>{{ finding.message ?? "n/a" }}</dd>
            <dt>Confidence</dt><dd>{{ finding.confidence ?? "n/a" }}</dd>
            <dt>Risk Code</dt><dd class="mono">{{ finding.riskCode ?? "n/a" }}</dd>
            <dt>CWE / WASC</dt><dd class="mono">{{ listValue(finding.cwe) }} / {{ listValue(finding.wasc) }}</dd>
            <dt>Location</dt><dd class="mono">{{ location(finding) }}</dd>
            <dt>Evidence</dt><dd>{{ finding.evidence ?? "n/a" }}</dd>
            <dt>Remediation</dt><dd>{{ finding.remediation ?? finding.help ?? "n/a" }}</dd>
            <dt>Help URI</dt><dd><a v-if="finding.helpUri" :href="finding.helpUri" target="_blank" rel="noopener">{{ finding.helpUri }}</a><span v-else>n/a</span></dd>
            <dt>Raw Source</dt><dd class="mono">{{ finding.sourcePath ?? "n/a" }}</dd>
          </dl>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MetricCard from "../components/MetricCard.vue";
import { severityColor } from "../format";
import type { Manifest, SecurityFinding, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const search = ref("");
const severity = ref("all");
const tool = ref("all");
const criticalOrHigh = computed(() => (props.manifest?.summary.security.critical ?? 0) + (props.manifest?.summary.security.high ?? 0));
const tools = computed(() => ["all", ...new Set((props.manifest?.security ?? []).map((finding) => finding.tool ?? "unknown"))]);
const toolSummaries = computed(() =>
  tools.value
    .filter((item) => item !== "all")
    .map((item) => ({ tool: item, count: props.manifest?.security.filter((finding) => (finding.tool ?? "unknown") === item).length ?? 0 }))
);
const filtered = computed(() =>
  (props.manifest?.security ?? [])
    .filter((finding) => severity.value === "all" || (finding.severity ?? "unknown") === severity.value)
    .filter((finding) => tool.value === "all" || (finding.tool ?? "unknown") === tool.value)
    .filter((finding) =>
      `${finding.title ?? ""} ${finding.message ?? ""} ${finding.ruleId ?? ""} ${finding.file ?? ""} ${finding.url ?? ""}`
        .toLowerCase()
        .includes(search.value.toLowerCase())
    )
);

function location(finding: SecurityFinding) {
  if (finding.url) return finding.url;
  if (finding.file) return `${finding.file}${finding.line ? `:${finding.line}` : ""}`;
  return "n/a";
}

function listValue(value?: string | string[]) {
  if (Array.isArray(value)) return value.join(", ") || "n/a";
  return value ?? "n/a";
}
</script>
