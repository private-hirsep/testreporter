<template>
  <div v-if="manifest">
    <h1>Coverage</h1>
    <div class="metrics">
      <MetricCard label="Total" :value="`${manifest.summary.coverage.totalPercentage ?? 'n/a'}%`" />
      <MetricCard label="Backend" :value="`${manifest.summary.coverage.backendPercentage ?? 'n/a'}%`" />
      <MetricCard label="Frontend" :value="`${manifest.summary.coverage.frontendPercentage ?? 'n/a'}%`" />
    </div>
    <v-expansion-panels>
      <v-expansion-panel v-for="item in manifest.coverage" :key="String(item.layer)">
        <v-expansion-panel-title>{{ item.layer }} coverage</v-expansion-panel-title>
        <v-expansion-panel-text><pre>{{ JSON.stringify(item, null, 2) }}</pre></v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import MetricCard from "../components/MetricCard.vue";
import type { Manifest, TestCase } from "../types";
defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
</script>
