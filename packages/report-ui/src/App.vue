<template>
  <v-app class="app-shell">
    <v-navigation-drawer permanent width="282" class="sidebar desktop-drawer">
      <div class="brand">
        <div class="brand-title">{{ manifest?.metadata.projectName ?? "Quality Report" }}</div>
        <div class="brand-subtitle">
          {{ manifest?.metadata.repository ?? "Static quality portal" }}
        </div>
      </div>
      <div v-if="manifest" class="brand-meta">
        <div class="meta-row">
          <span>Branch</span
          ><strong class="mono truncate">{{ manifest.metadata.branch ?? "n/a" }}</strong>
        </div>
        <div class="meta-row">
          <span>Commit</span
          ><strong class="mono truncate">{{ shortSha(manifest.metadata.commitSha) }}</strong>
        </div>
        <div class="meta-row">
          <span>Run</span
          ><strong class="mono truncate">{{ manifest.metadata.runId ?? "n/a" }}</strong>
        </div>
      </div>
      <v-list nav density="compact">
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
        />
      </v-list>
    </v-navigation-drawer>
    <v-app-bar flat border color="surface">
      <v-menu class="mobile-nav">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            icon="mdi-menu"
            class="mobile-nav"
            aria-label="Open navigation"
          />
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="item in navItems"
            :key="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
            :to="item.to"
          />
        </v-list>
      </v-menu>
      <v-app-bar-title>
        <span>{{ manifest?.metadata.projectName ?? "Quality Portal" }}</span>
      </v-app-bar-title>
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
import { shortSha } from "./format";
import { loadManifest, loadTests } from "./services/reportData";
import type { Manifest, TestCase } from "./types";

const manifest = ref<Manifest>();
const tests = ref<TestCase[]>([]);
const error = ref("");
const navItems = [
  { title: "Dashboard", to: "/", icon: "mdi-view-dashboard" },
  { title: "Release Readiness", to: "/readiness", icon: "mdi-rocket-launch" },
  { title: "Tests", to: "/tests", icon: "mdi-test-tube" },
  { title: "Manual Testing", to: "/manual", icon: "mdi-clipboard-edit-outline" },
  { title: "Coverage", to: "/coverage", icon: "mdi-chart-donut" },
  { title: "Requirements", to: "/requirements", icon: "mdi-clipboard-check" },
  { title: "Security", to: "/security", icon: "mdi-shield-alert" },
  { title: "Downloads", to: "/downloads", icon: "mdi-download" },
  { title: "Diagnostics", to: "/diagnostics", icon: "mdi-alert-circle-outline" },
  { title: "History", to: "/history", icon: "mdi-history" }
];

onMounted(async () => {
  try {
    manifest.value = await loadManifest();
    tests.value = await loadTests(manifest.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load report data";
  }
});
</script>
