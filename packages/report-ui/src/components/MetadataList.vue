<template>
  <dl class="detail-list">
    <template v-for="item in visible" :key="item.label">
      <dt>{{ item.label }}</dt>
      <dd :class="{ mono: item.mono }">
        <a v-if="item.href" :href="item.href" target="_blank" rel="noopener">{{ item.value }}</a>
        <template v-else>{{ item.value }}</template>
      </dd>
    </template>
  </dl>
</template>

<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{
  items: Array<{
    label: string;
    value?: string | number | undefined;
    mono?: boolean | undefined;
    href?: string | undefined;
  }>;
  /** When set, rows without a value are rendered with this placeholder instead of omitted. */
  placeholder?: string;
}>();
const visible = computed(() =>
  props.items
    .map((item) =>
      item.value === undefined || item.value === ""
        ? { ...item, value: props.placeholder, href: undefined }
        : item
    )
    .filter((item) => item.value !== undefined)
);
</script>
