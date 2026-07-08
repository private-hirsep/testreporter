<template>
  <div v-if="manifest">
    <section class="gate-hero" :data-status="manifest.qualityGate.status">
      <div class="gate-hero-main">
        <div class="gate-icon" aria-hidden="true"><v-icon :icon="gateIcon" size="26" /></div>
        <div>
          <h1 class="gate-title">Quality Gate {{ manifest.qualityGate.status.toUpperCase() }}</h1>
          <div class="gate-subtitle">
            {{ manifest.metadata.repository ?? manifest.metadata.projectName }} - profile {{ manifest.qualityGate.profile ?? manifest.metadata.qualityProfile ?? "standard" }} - generated {{ generatedAt }}
          </div>
        </div>
        <v-btn
          v-if="manifest.warnings.length"
          to="/diagnostics"
          color="warning"
          variant="tonal"
          size="small"
          prepend-icon="mdi-alert-circle-outline"
          class="gate-warnings"
        >
          {{ manifest.warnings.length }} warning{{ manifest.warnings.length === 1 ? "" : "s" }}
        </v-btn>
      </div>
      <div v-if="manifest.qualityGate.checks.length" class="gate-checks">
        <div
          v-for="check in manifest.qualityGate.checks"
          :key="check.id"
          class="gate-check"
          :data-status="check.status"
          :title="check.message ?? `expected ${check.expected}`"
        >
          <v-icon size="x-small" :icon="checkIcon(check.status)" :color="checkColor(check.status)" />
          <span>{{ check.label }}</span>
          <strong class="mono">{{ checkActual(check) }}</strong>
        </div>
      </div>
    </section>
    <div class="dashboard-overview">
      <v-card class="portal-card summary-panel" variant="flat">
        <div class="portal-card-title"><h2>Test Health</h2><v-btn to="/tests" size="small" variant="text">Open tests</v-btn></div>
        <v-card-text>
          <div class="inline-metrics">
            <div><strong>{{ manifest.summary.tests.total }}</strong><span>Total</span></div>
            <div><strong class="text-success">{{ manifest.summary.tests.passed }}</strong><span><i class="dot dot-pass" />Passed</span></div>
            <div><strong :class="manifest.summary.tests.failed ? 'text-error' : ''">{{ manifest.summary.tests.failed }}</strong><span><i class="dot dot-failed" />Failed</span></div>
            <div><strong>{{ manifest.summary.tests.broken }}</strong><span><i class="dot dot-broken" />Broken</span></div>
            <div><strong>{{ manifest.summary.tests.skipped }}</strong><span><i class="dot dot-skipped" />Skipped</span></div>
            <div v-if="manifest.summary.tests.unknown"><strong>{{ manifest.summary.tests.unknown }}</strong><span><i class="dot dot-unknown" />Unknown</span></div>
          </div>
          <div class="distribution" aria-label="Test status distribution">
            <span class="bar-pass" :style="{ width: `${percentFor(manifest.summary.tests.passed)}%` }" />
            <span class="bar-failed" :style="{ width: `${percentFor(manifest.summary.tests.failed)}%` }" />
            <span class="bar-broken" :style="{ width: `${percentFor(manifest.summary.tests.broken)}%` }" />
            <span class="bar-skipped" :style="{ width: `${percentFor(manifest.summary.tests.skipped)}%` }" />
            <span class="bar-unknown" :style="{ width: `${percentFor(manifest.summary.tests.unknown)}%` }" />
          </div>
          <div v-if="retriedCount" class="panel-note">
            <v-icon size="x-small" icon="mdi-repeat" /> {{ retriedCount }} test{{ retriedCount === 1 ? "" : "s" }} needed retries
          </div>
        </v-card-text>
      </v-card>
      <v-card class="portal-card summary-panel" variant="flat">
        <div class="portal-card-title"><h2>Coverage</h2><v-btn to="/coverage" size="small" variant="text">Open coverage</v-btn></div>
        <v-card-text>
          <ProgressMetric
            v-for="item in coverageBreakdown"
            :key="item.label"
            :label="item.label"
            :percent="item.value ?? 0"
            :display="formatPercent(item.value)"
            :tone="coverageClass(item.value)"
          />
          <div v-if="lowCoverageCount" class="panel-note">
            <v-icon size="x-small" icon="mdi-alert-outline" /> {{ lowCoverageCount }} file{{ lowCoverageCount === 1 ? "" : "s" }} below 70% line coverage
          </div>
        </v-card-text>
      </v-card>
      <v-card class="portal-card summary-panel" variant="flat">
        <div class="portal-card-title"><h2>Risk &amp; Compliance</h2><v-btn to="/security" size="small" variant="text">Open security</v-btn></div>
        <v-card-text>
          <div class="inline-metrics">
            <div><strong>{{ formatPercent(manifest.requirements.percentage) }}</strong><span>Req. coverage</span></div>
            <div><strong :class="manifest.requirements.missing.length ? 'text-error' : 'text-success'">{{ manifest.requirements.missing.length }}</strong><span>Missing reqs</span></div>
            <div><strong :class="manifest.requirements.extra.length ? 'text-warning' : ''">{{ manifest.requirements.extra.length }}</strong><span>Extra reqs</span></div>
            <div><strong :class="securityTotal ? 'text-error' : 'text-success'">{{ securityTotal }}</strong><span>Findings</span></div>
          </div>
          <div v-if="severityChips.length" class="severity-chips">
            <v-chip v-for="item in severityChips" :key="item.label" size="small" :color="severityColor(item.label)" label>
              {{ item.label }} · {{ item.value }}
            </v-chip>
          </div>
          <div v-else class="panel-note">
            <v-icon size="x-small" icon="mdi-shield-check-outline" color="success" /> No security findings for this run
          </div>
          <div v-if="manifest.requirements.missing.length" class="panel-note">
            <v-icon size="x-small" icon="mdi-alert-outline" color="warning" />
            <router-link to="/requirements">Review {{ manifest.requirements.missing.length }} missing requirement{{ manifest.requirements.missing.length === 1 ? "" : "s" }}</router-link>
          </div>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ProgressMetric from "../components/ProgressMetric.vue";
import { formatPercent, severityColor } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();

const generatedAt = computed(() => (props.manifest ? new Date(props.manifest.metadata.generatedAt).toLocaleString() : ""));
const securityTotal = computed(() => Object.values(props.manifest?.summary.security ?? {}).reduce((sum, value) => sum + value, 0));
const retriedCount = computed(() => props.tests.filter((test) => test.retries > 0).length);
const testTotal = computed(() => props.manifest?.summary.tests.total || 1);
const gateIcon = computed(() => {
  const status = props.manifest?.qualityGate.status;
  if (status === "passed") return "mdi-check-decagram";
  if (status === "failed") return "mdi-close-octagon";
  if (status === "skipped") return "mdi-debug-step-over";
  return "mdi-help-circle-outline";
});
const coverageBreakdown = computed(() => [
  { label: "Total", value: props.manifest?.summary.coverage.totalPercentage },
  { label: "Backend", value: props.manifest?.summary.coverage.backendPercentage },
  { label: "Frontend", value: props.manifest?.summary.coverage.frontendPercentage }
]);
const lowCoverageCount = computed(
  () =>
    (props.manifest?.coverage ?? [])
      .flatMap((item) => item.files ?? [])
      .filter((file) => (file.lines?.percentage ?? 100) < 70).length
);
const severityChips = computed(() =>
  ["critical", "high", "medium", "low", "info", "unknown"]
    .map((label) => ({ label, value: props.manifest?.summary.security[label] ?? 0 }))
    .filter((item) => item.value > 0)
);

function percentFor(value: number) {
  return Math.max((value / testTotal.value) * 100, value > 0 ? 4 : 0);
}

function checkIcon(status: string) {
  if (status === "passed") return "mdi-check-circle";
  if (status === "failed") return "mdi-close-circle";
  if (status === "skipped") return "mdi-debug-step-over";
  return "mdi-alert-circle";
}

function checkColor(status: string) {
  if (status === "passed") return "success";
  if (status === "failed") return "error";
  if (status === "skipped") return "info";
  return "warning";
}

function checkActual(check: { actual: string | number; expected: string }) {
  if (typeof check.actual === "number" && check.expected.includes("%")) return formatPercent(check.actual);
  return check.actual;
}

function coverageClass(value?: number) {
  if (value === undefined) return "medium";
  if (value < 70) return "low";
  if (value < 85) return "medium";
  return "";
}
</script>
