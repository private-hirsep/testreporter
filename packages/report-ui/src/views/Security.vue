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
    <section class="summary-strip">
      <div>
        <div class="page-kicker">Security findings</div>
        <div class="summary-number">{{ manifest.security.length }}</div>
        <div class="tool-chips">
          <v-chip v-for="summary in toolSummaries" :key="summary.tool" size="small" variant="tonal" label class="mono">
            {{ summary.tool }} · {{ summary.count }}
          </v-chip>
        </div>
      </div>
      <div>
        <div v-for="item in severityBreakdown" :key="item.label" class="chart-row">
          <span class="text-capitalize">{{ item.label }}</span>
          <div class="progress-track"><div class="progress-fill" :class="item.class" :style="{ width: severityWidth(item.value) }" /></div>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </section>
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
            <v-chip size="small" :color="severityColor(finding.severity)" label>{{ finding.severity }}</v-chip>
            <v-chip size="small" variant="outlined" label>{{ finding.tool }}</v-chip>
            <strong>{{ finding.title }}</strong>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <dl class="detail-list">
            <dt>Rule ID</dt><dd class="mono">{{ finding.ruleId ?? "n/a" }}</dd>
            <dt>Message</dt><dd>{{ finding.message ?? "n/a" }}</dd>
            <dt>Description</dt><dd>{{ finding.description ?? "n/a" }}</dd>
            <dt>Confidence</dt><dd>{{ finding.confidence ?? "n/a" }}</dd>
            <dt>Precision</dt><dd>{{ finding.precision ?? "n/a" }}</dd>
            <dt>Risk Code</dt><dd class="mono">{{ finding.riskCode ?? "n/a" }}</dd>
            <dt>CWE / WASC</dt><dd class="mono">{{ cweWasc(finding) }}</dd>
            <dt>Tags</dt>
            <dd>
              <v-chip v-for="tag in finding.tags" :key="tag" size="x-small" class="mr-1 mb-1 mono" variant="outlined" label>{{ tag }}</v-chip>
              <span v-if="!finding.tags.length">none</span>
            </dd>
            <dt>Location</dt><dd class="mono">{{ location(finding) }}</dd>
            <dt>Evidence</dt><dd class="mono wrap-anywhere">{{ finding.evidence ?? "n/a" }}</dd>
            <dt>Remediation</dt><dd>{{ finding.remediation ?? "n/a" }}</dd>
            <dt>Help URI</dt><dd><a v-if="finding.helpUri" :href="finding.helpUri" target="_blank" rel="noopener">{{ finding.helpUri }}</a><span v-else>n/a</span></dd>
            <dt>Raw Report</dt>
            <dd>
              <a v-if="rawReportFor(finding)" :href="rawReportFor(finding)!.path" target="_blank" rel="noopener">{{ rawReportFor(finding)!.name }}</a>
              <span v-else class="mono">{{ finding.sourcePath ?? "n/a" }}</span>
            </dd>
          </dl>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { severityColor } from "../format";
import type { Download, Manifest, SecurityFinding, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const search = ref("");
const severity = ref("all");
const tool = ref("all");
const criticalOrHigh = computed(() => (props.manifest?.summary.security.critical ?? 0) + (props.manifest?.summary.security.high ?? 0));
const tools = computed(() => ["all", ...new Set((props.manifest?.security ?? []).map((finding) => finding.tool))]);
const toolSummaries = computed(() =>
  tools.value
    .filter((item) => item !== "all")
    .map((item) => ({ tool: item, count: props.manifest?.security.filter((finding) => finding.tool === item).length ?? 0 }))
);
const severityBreakdown = computed(() =>
  ["critical", "high", "medium", "low", "info"].map((label) => ({
    label,
    value: props.manifest?.summary.security[label] ?? 0,
    class: label === "critical" || label === "high" ? "low" : label === "medium" ? "medium" : ""
  }))
);
const filtered = computed(() =>
  (props.manifest?.security ?? [])
    .filter((finding) => severity.value === "all" || finding.severity === severity.value)
    .filter((finding) => tool.value === "all" || finding.tool === tool.value)
    .filter((finding) =>
      `${finding.title} ${finding.message ?? ""} ${finding.ruleId ?? ""} ${finding.file ?? ""} ${finding.url ?? ""}`
        .toLowerCase()
        .includes(search.value.toLowerCase())
    )
);

function severityWidth(value: number) {
  const max = Math.max(...Object.values(props.manifest?.summary.security ?? {}), 1);
  return `${Math.max((value / max) * 100, value > 0 ? 6 : 0)}%`;
}

function location(finding: SecurityFinding) {
  if (finding.url) return finding.url;
  if (finding.file) return `${finding.file}${finding.line ? `:${finding.line}` : ""}`;
  return "n/a";
}

function cweWasc(finding: SecurityFinding) {
  const parts = [finding.cweId ? `CWE-${finding.cweId}` : "", finding.wascId ? `WASC-${finding.wascId}` : ""].filter(Boolean);
  return parts.join(", ") || "n/a";
}

function rawReportFor(finding: SecurityFinding): Download | undefined {
  return props.manifest?.downloads.find(
    (download) => download.category === "security" && download.sourcePath === finding.sourcePath
  );
}
</script>
