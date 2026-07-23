<template>
  <v-app class="app-shell">
    <!-- Plain hash hrefs are interpreted as routes by the hash router, so the
         skip link moves focus programmatically instead. -->
    <a class="skip-link" href="#main-content" @click.prevent="focusMain">Skip to content</a>
    <AppNavigation :manifest="manifest" :model="drawer" @update:model-value="drawer = $event" />
    <v-app-bar v-if="!mdAndUp" flat border color="surface" density="compact">
      <v-btn
        icon="mdi-menu"
        aria-label="Open navigation"
        @click="drawer = !drawer"
      />
      <v-app-bar-title>
        <span>{{ manifest?.metadata.projectName ?? "Quality Report" }}</span>
      </v-app-bar-title>
    </v-app-bar>
    <v-main>
      <v-container id="main-content" fluid class="page" tabindex="-1">
        <v-alert v-if="error" type="error" variant="tonal">{{ error }}</v-alert>
        <template v-else-if="loading">
          <div class="page-loading" role="status" aria-live="polite">
            <v-progress-circular indeterminate size="28" width="3" />
            <span>Loading report data…</span>
          </div>
        </template>
        <template v-else>
          <ProjectContextHeader :manifest="manifest" />
          <router-view :manifest="manifest" :tests="tests" />
        </template>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useDisplay } from "vuetify";
import AppNavigation from "./components/AppNavigation.vue";
import ProjectContextHeader from "./components/ProjectContextHeader.vue";
import { loadManifest, loadTests } from "./services/reportData";
import type { Manifest, TestCase } from "./types";

const manifest = ref<Manifest>();
const tests = ref<TestCase[]>([]);
const error = ref("");
const loading = ref(true);
const drawer = ref(false);
const { mdAndUp } = useDisplay();

function focusMain() {
  document.getElementById("main-content")?.focus();
}

onMounted(async () => {
  try {
    manifest.value = await loadManifest();
    tests.value = await loadTests(manifest.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load report data";
  } finally {
    loading.value = false;
  }
});
</script>
