<!-- Un indicateur compact : pastille colorée, libellé, valeur. -->
<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string
  icon: string
  color?: 'primary' | 'success' | 'info' | 'warning' | 'error' | 'secondary'
  loading?: boolean
}>(), { color: 'primary' })
</script>

<template>
  <div class="d-flex align-center gap-3">
    <VAvatar
      :color="color"
      variant="flat"
      rounded
      size="44"
      class="elevation-2"
    >
      <VIcon
        :icon="icon"
        size="26"
      />
    </VAvatar>
    <div class="min-w-0">
      <div class="text-body-2 text-medium-emphasis">
        {{ label }}
      </div>
      <VSkeletonLoader
        v-if="loading"
        type="text"
        width="80"
        class="bg-transparent"
      />
      <div
        v-else
        class="text-h6 font-weight-semibold tabular-nums text-no-wrap"
      >
        {{ value }}
      </div>
    </div>
  </div>
</template>
