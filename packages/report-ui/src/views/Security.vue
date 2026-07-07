<template>
  <div v-if="manifest">
    <h1>Security</h1>
    <div class="metrics">
      <MetricCard label="Critical" :value="manifest.summary.security.critical ?? 0" />
      <MetricCard label="High" :value="manifest.summary.security.high ?? 0" />
      <MetricCard label="Medium" :value="manifest.summary.security.medium ?? 0" />
      <MetricCard label="Low" :value="manifest.summary.security.low ?? 0" />
      <MetricCard label="Info" :value="manifest.summary.security.info ?? 0" />
    </div>
    <v-table density="compact">
      <thead><tr><th>Severity</th><th>Tool</th><th>Rule</th><th>Finding</th><th>Location</th></tr></thead>
      <tbody>
        <tr v-for="finding in manifest.security" :key="finding.id">
          <td>{{ finding.severity }}</td>
          <td>{{ finding.tool }}</td>
          <td>{{ finding.ruleId }}</td>
          <td><router-link :to="`/security/${finding.id}`">{{ finding.title }}</router-link></td>
          <td>
            <span v-if="finding.file">{{ finding.file }}<span v-if="finding.line">:{{ finding.line }}</span></span>
            <span v-else>{{ finding.url ?? "n/a" }}</span>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import MetricCard from "../components/MetricCard.vue";
import type { Manifest, TestCase } from "../types";
defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
</script>
