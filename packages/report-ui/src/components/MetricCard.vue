<template>
  <section class="portal-card metric-card">
    <div class="metric-card-head">
      <h2>{{ title }}</h2>
      <StatusChip v-if="status" :status="status" size="small" />
    </div>
    <div class="metric-card-headline">{{ headline }}</div>
    <div v-if="items?.length" class="metric-card-items">
      <div v-for="item in items" :key="item.label">
        <strong :class="toneClass(item.tone)">{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </div>
    </div>
    <p v-if="note" class="metric-card-note">{{ note }}</p>
    <div v-if="to" class="metric-card-link">
      <v-btn :to="to" size="small" variant="text" append-icon="mdi-arrow-right">
        {{ linkLabel ?? "Open" }}
      </v-btn>
    </div>
  </section>
</template>

<script setup lang="ts">
import StatusChip from "./StatusChip.vue";
defineProps<{
  title: string;
  headline: string;
  status?: string | undefined;
  items?:
    | Array<{
        label: string;
        value: string | number;
        tone?: "positive" | "negative" | "caution" | "neutral" | undefined;
      }>
    | undefined;
  note?: string | undefined;
  to?: string | undefined;
  linkLabel?: string | undefined;
}>();

function toneClass(tone?: string) {
  if (tone === "positive") return "text-success";
  if (tone === "negative") return "text-error";
  if (tone === "caution") return "text-warning";
  return "";
}
</script>
