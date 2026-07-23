<template>
  <section class="portal-card section-card">
    <div v-if="title || $slots.actions" class="section-card-head">
      <div>
        <h2 v-if="title">{{ title }}</h2>
        <p v-if="description" class="section-card-description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="section-card-actions"><slot name="actions" /></div>
    </div>
    <div class="section-card-body" :class="{ flush }">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string | undefined;
  description?: string | undefined;
  flush?: boolean | undefined;
}>();
</script>
