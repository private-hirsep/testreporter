<template>
  <div v-if="manifest">
    <h1>Downloads</h1>
    <v-table density="compact">
      <thead><tr><th>Name</th><th>Category</th><th>Source</th><th>Size</th><th>Link</th></tr></thead>
      <tbody>
        <tr v-for="download in manifest.downloads" :key="download.id">
          <td>{{ download.name }}</td>
          <td>{{ download.category }}</td>
          <td>{{ download.sourcePath ?? "generated" }}</td>
          <td>{{ download.sizeBytes ?? "directory" }}</td>
          <td><a :href="download.path" target="_blank" rel="noopener">download</a></td>
        </tr>
      </tbody>
    </v-table>
    <h2 class="section-heading">Parser Warnings</h2>
    <v-table density="compact">
      <thead><tr><th>Code</th><th>Source</th><th>Message</th></tr></thead>
      <tbody>
        <tr v-for="warning in manifest.warnings" :key="`${warning.code}-${warning.sourcePath}-${warning.message}`">
          <td>{{ warning.code }}</td>
          <td>{{ warning.sourcePath ?? "n/a" }}</td>
          <td>{{ warning.message }}</td>
        </tr>
        <tr v-if="manifest.warnings.length === 0">
          <td colspan="3">No parser warnings or skipped malformed inputs were recorded.</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import type { Manifest, TestCase } from "../types";
defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
</script>
