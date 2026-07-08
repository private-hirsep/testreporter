<template>
  <div v-if="manifest">
    <PageHeader title="Diagnostics" subtitle="Parser warnings and report generation diagnostics">
      <v-chip :color="manifest.warnings.length ? 'warning' : 'success'" label>{{ manifest.warnings.length }} warning(s)</v-chip>
    </PageHeader>
    <v-alert v-if="!manifest.warnings.length" type="success" variant="tonal">
      No parser warnings were recorded for this run.
    </v-alert>
    <v-table v-else density="compact" class="data-table">
      <thead><tr><th>Severity</th><th>Source Artifact</th><th>Code</th><th>Message</th></tr></thead>
      <tbody>
        <tr v-for="warning in manifest.warnings" :key="`${warning.code}-${warning.sourcePath}-${warning.message}`">
          <td><v-chip size="small" color="warning" label>warning</v-chip></td>
          <td class="mono">{{ warning.sourcePath ?? "n/a" }}</td>
          <td class="mono">{{ warning.code }}</td>
          <td>{{ warning.message }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "../components/PageHeader.vue";
import type { Manifest, TestCase } from "../types";
defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
</script>
