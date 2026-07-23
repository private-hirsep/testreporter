<template>
  <v-navigation-drawer
    :model-value="mdAndUp || model"
    :permanent="mdAndUp"
    :temporary="!mdAndUp"
    width="264"
    class="sidebar"
    aria-label="Primary navigation"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <div class="brand">
      <div class="brand-title">{{ manifest?.metadata.projectName ?? "Quality Report" }}</div>
      <div class="brand-subtitle">
        {{ manifest?.metadata.repository ?? "Static quality workspace" }}
      </div>
    </div>
    <nav aria-label="Report sections">
      <v-list nav density="compact">
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
          :exact="item.to === '/'"
        />
      </v-list>
    </nav>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { useDisplay } from "vuetify";
import { navItems } from "../services/navigation";
import type { Manifest } from "../types";

defineProps<{ manifest?: Manifest | undefined; model: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const { mdAndUp } = useDisplay();
</script>
