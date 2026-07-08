<template>
  <div v-if="manifest">
    <div class="page-heading">
      <div>
        <h1>History</h1>
        <div class="page-kicker">Current-run summary prepared for future history merging</div>
      </div>
      <v-chip :color="gateColor(manifest.qualityGate.status)" label>{{ manifest.qualityGate.status }}</v-chip>
    </div>
    <v-alert type="info" variant="tonal" class="mb-4">
      Historical trend merging is not enabled for this static report yet. This page shows the current run without inventing prior data.
    </v-alert>
    <section class="summary-strip">
      <div>
        <div class="page-kicker">Current run</div>
        <div class="summary-number">{{ generatedDate }}</div>
      </div>
      <div class="inline-metrics">
        <div><strong>{{ manifest.summary.tests.total }}</strong><span>Tests</span></div>
        <div><strong>{{ formatPercent(manifest.summary.coverage.totalPercentage) }}</strong><span>Coverage</span></div>
        <div><strong>{{ formatPercent(manifest.requirements.percentage) }}</strong><span>Requirements</span></div>
        <div><strong :class="securityTotal ? 'text-error' : 'text-success'">{{ securityTotal }}</strong><span>Security findings</span></div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatPercent, gateColor } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const generatedDate = computed(() => (props.manifest ? new Date(props.manifest.metadata.generatedAt).toLocaleDateString() : "n/a"));
const securityTotal = computed(() => Object.values(props.manifest?.summary.security ?? {}).reduce((sum, value) => sum + value, 0));
</script>
