<template>
  <v-app>
    <v-navigation-drawer permanent width="260">
      <div class="brand">
        <div class="brand-title">{{ manifest?.metadata.projectName ?? "Quality Report" }}</div>
        <div class="brand-subtitle">{{ manifest?.metadata.repository ?? "Static quality portal" }}</div>
      </div>
      <v-list nav density="compact">
        <v-list-item prepend-icon="mdi-view-dashboard" title="Dashboard" to="/" />
        <v-list-item prepend-icon="mdi-test-tube" title="Tests" to="/tests" />
        <v-list-item prepend-icon="mdi-chart-donut" title="Coverage" to="/coverage" />
        <v-list-item prepend-icon="mdi-clipboard-check" title="Requirements" to="/requirements" />
        <v-list-item prepend-icon="mdi-shield-alert" title="Security" to="/security" />
        <v-list-item prepend-icon="mdi-download" title="Downloads" to="/downloads" />
        <v-list-item prepend-icon="mdi-history" title="History" to="/history" />
      </v-list>
    </v-navigation-drawer>
    <v-app-bar flat border>
      <v-app-bar-title>Quality Portal</v-app-bar-title>
      <v-chip v-if="manifest" :color="manifest.qualityGate.status === 'passed' ? 'success' : 'error'" label>
        Gate {{ manifest.qualityGate.status }}
      </v-chip>
    </v-app-bar>
    <v-main>
      <v-container fluid class="page">
        <v-alert v-if="error" type="error" variant="tonal">{{ error }}</v-alert>
        <router-view v-else :manifest="manifest" :tests="tests" />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { loadManifest, loadTests } from "./services/reportData";
import type { Manifest, TestCase } from "./types";

const manifest = ref<Manifest>();
const tests = ref<TestCase[]>([]);
const error = ref("");

onMounted(async () => {
  try {
    manifest.value = await loadManifest();
    tests.value = await loadTests(manifest.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load report data";
  }
});
</script>
