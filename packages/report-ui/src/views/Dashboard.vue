<template>
  <div v-if="manifest">
    <div class="page-heading">
      <div>
        <h1>Dashboard</h1>
        <div class="page-kicker">Generated {{ generatedAt }} for {{ manifest.metadata.repository ?? manifest.metadata.projectName }}</div>
      </div>
      <v-chip :color="gateColor(manifest.qualityGate.status)" prepend-icon="mdi-gate" label>
        Quality Gate {{ manifest.qualityGate.status }}
      </v-chip>
    </div>
    <section class="gate-banner" :data-status="manifest.qualityGate.status">
      <div>
        <div class="gate-title">Quality Gate {{ manifest.qualityGate.status.toUpperCase() }}</div>
        <div class="gate-subtitle">{{ failingChecks.length ? `${failingChecks.length} check(s) need attention` : "All configured checks passed for this run" }}</div>
      </div>
      <v-btn to="/diagnostics" :color="manifest.warnings.length ? 'warning' : 'primary'" variant="flat" prepend-icon="mdi-alert-circle-outline">
        {{ manifest.warnings.length }} warning{{ manifest.warnings.length === 1 ? "" : "s" }}
      </v-btn>
    </section>
    <div class="dashboard-overview">
      <v-card class="portal-card summary-panel" variant="flat">
        <div class="portal-card-title"><h2>Test Status Distribution</h2><v-btn to="/tests" size="small" variant="text">Open tests</v-btn></div>
        <v-card-text>
          <div class="inline-metrics">
            <div><strong>{{ manifest.summary.tests.total }}</strong><span>Total</span></div>
            <div><strong class="text-success">{{ manifest.summary.tests.passed }}</strong><span>Passed</span></div>
            <div><strong class="text-error">{{ manifest.summary.tests.failed }}</strong><span>Failed</span></div>
            <div><strong>{{ manifest.summary.tests.broken + manifest.summary.tests.skipped }}</strong><span>Skipped/Broken</span></div>
          </div>
          <div class="distribution" aria-label="Test status distribution">
            <span class="bar-pass" :style="{ width: widthFor(manifest.summary.tests.passed) }" />
            <span class="bar-failed" :style="{ width: widthFor(manifest.summary.tests.failed) }" />
            <span class="bar-broken" :style="{ width: widthFor(manifest.summary.tests.broken) }" />
            <span class="bar-skipped" :style="{ width: widthFor(manifest.summary.tests.skipped) }" />
            <span class="bar-unknown" :style="{ width: widthFor(manifest.summary.tests.unknown) }" />
          </div>
          <div v-for="item in testBreakdown" :key="item.label" class="chart-row">
            <span>{{ item.label }}</span><div class="progress-track"><div class="progress-fill" :class="item.class" :style="{ width: widthFor(item.value) }" /></div><strong>{{ item.value }}</strong>
          </div>
        </v-card-text>
      </v-card>
      <v-card class="portal-card summary-panel" variant="flat">
        <div class="portal-card-title"><h2>Coverage Comparison</h2><v-btn to="/coverage" size="small" variant="text">Open coverage</v-btn></div>
        <v-card-text>
          <div v-for="item in coverageBreakdown" :key="item.label" class="chart-row">
            <span>{{ item.label }}</span><div class="progress-track"><div class="progress-fill" :class="coverageClass(item.value)" :style="{ width: `${item.value ?? 0}%` }" /></div><strong>{{ formatPercent(item.value) }}</strong>
          </div>
        </v-card-text>
      </v-card>
      <v-card class="portal-card summary-panel" variant="flat">
        <div class="portal-card-title"><h2>Security & Requirements</h2><v-btn to="/security" size="small" variant="text">Open security</v-btn></div>
        <v-card-text>
          <div class="inline-metrics">
            <div><strong :class="securityTotal ? 'text-error' : 'text-success'">{{ securityTotal }}</strong><span>Findings</span></div>
            <div><strong>{{ formatPercent(manifest.requirements.percentage) }}</strong><span>Req. coverage</span></div>
            <div><strong :class="manifest.requirements.missing.length ? 'text-warning' : 'text-success'">{{ manifest.requirements.missing.length }}</strong><span>Missing reqs</span></div>
          </div>
          <div v-for="item in severityBreakdown" :key="item.label" class="chart-row">
            <span>{{ item.label }}</span><div class="progress-track"><div class="progress-fill" :class="item.class" :style="{ width: severityWidth(item.value) }" /></div><strong>{{ item.value }}</strong>
          </div>
        </v-card-text>
      </v-card>
    </div>
    <section class="quality-areas">
      <div class="portal-card-title"><h2>Quality Areas</h2></div>
      <v-list lines="two" bg-color="transparent">
        <v-list-item v-for="section in sections" :key="section.to" :to="section.to" :prepend-icon="section.icon">
          <v-list-item-title>{{ section.title }}</v-list-item-title>
          <v-list-item-subtitle>{{ section.text }}</v-list-item-subtitle>
          <template #append><v-icon icon="mdi-chevron-right" /></template>
        </v-list-item>
      </v-list>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatPercent, gateColor } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();

const generatedAt = computed(() => (props.manifest ? new Date(props.manifest.metadata.generatedAt).toLocaleString() : ""));
const failingChecks = computed(() => props.manifest?.qualityGate.checks.filter((check) => check.status !== "passed") ?? []);
const securityTotal = computed(() => Object.values(props.manifest?.summary.security ?? {}).reduce((sum, value) => sum + value, 0));
const testTotal = computed(() => props.manifest?.summary.tests.total || 1);
const testBreakdown = computed(() => [
  { label: "Passed", value: props.manifest?.summary.tests.passed ?? 0, class: "" },
  { label: "Failed", value: props.manifest?.summary.tests.failed ?? 0, class: "low" },
  { label: "Broken", value: props.manifest?.summary.tests.broken ?? 0, class: "low" },
  { label: "Skipped", value: props.manifest?.summary.tests.skipped ?? 0, class: "medium" },
  { label: "Unknown", value: props.manifest?.summary.tests.unknown ?? 0, class: "medium" }
]);
const coverageBreakdown = computed(() => [
  { label: "Total", value: props.manifest?.summary.coverage.totalPercentage },
  { label: "Backend", value: props.manifest?.summary.coverage.backendPercentage },
  { label: "Frontend", value: props.manifest?.summary.coverage.frontendPercentage }
]);
const severityBreakdown = computed(() =>
  ["critical", "high", "medium", "low", "info"].map((label) => ({
    label,
    value: props.manifest?.summary.security[label] ?? 0,
    class: label === "critical" || label === "high" ? "low" : label === "medium" ? "medium" : ""
  }))
);
const sections = computed(() => [
  { title: "Tests", to: "/tests", icon: "mdi-test-tube", text: `${props.manifest?.summary.tests.failed ?? 0} failed, ${props.manifest?.summary.tests.broken ?? 0} broken` },
  { title: "Requirements", to: "/requirements", icon: "mdi-clipboard-check", text: `${props.manifest?.requirements.missing.length ?? 0} missing requirement(s)` },
  { title: "Security", to: "/security", icon: "mdi-shield-alert", text: `${securityTotal.value} finding(s) across configured scanners` },
  { title: "Downloads", to: "/downloads", icon: "mdi-download", text: `${props.manifest?.downloads.length ?? 0} static artifact(s) available` },
  { title: "Diagnostics", to: "/diagnostics", icon: "mdi-alert-circle-outline", text: `${props.manifest?.warnings.length ?? 0} parser warning(s)` },
  { title: "History", to: "/history", icon: "mdi-history", text: "Current run is stored in history-ready static data" }
]);

function widthFor(value: number) {
  return `${Math.max((value / testTotal.value) * 100, value > 0 ? 4 : 0)}%`;
}

function severityWidth(value: number) {
  const max = Math.max(...Object.values(props.manifest?.summary.security ?? { value: 1 }), 1);
  return `${Math.max((value / max) * 100, value > 0 ? 6 : 0)}%`;
}

function coverageClass(value?: number) {
  if (value === undefined) return "medium";
  if (value < 70) return "low";
  if (value < 85) return "medium";
  return "";
}
</script>
