<!-- Bandeau d'indicateurs : plusieurs chiffres clés dans une seule carte, séparés par des filets. -->
<script setup lang="ts">
export interface StatStripItem {
  label: string
  value: string
  icon: string
  hint?: string
  hintColor?: 'success' | 'error' | 'warning' | 'info' | 'secondary'
}

defineProps<{
  items: StatStripItem[]
  loading?: boolean
}>()
</script>

<template>
  <VCard>
    <VRow no-gutters>
      <VCol
        v-for="(item, index) in items"
        :key="item.label"
        cols="12"
        sm="6"
        :lg="12 / items.length"
        class="strip-cell"
        :class="{ 'strip-cell--last': index === items.length - 1 }"
      >
        <div class="d-flex justify-space-between gap-3 pa-5">
          <div class="min-w-0">
            <div class="text-body-1 text-medium-emphasis">
              {{ item.label }}
            </div>
            <VSkeletonLoader
              v-if="loading"
              type="heading"
              width="150"
              class="bg-transparent mt-1"
            />
            <div
              v-else
              class="text-h4 font-weight-semibold tabular-nums text-no-wrap mt-1"
            >
              {{ item.value }}
            </div>
            <div
              v-if="item.hint && !loading"
              class="mt-2"
            >
              <VChip
                v-if="item.hintColor"
                :color="item.hintColor"
                size="small"
                label
              >
                {{ item.hint }}
              </VChip>
              <span
                v-else
                class="text-body-2 text-medium-emphasis"
              >{{ item.hint }}</span>
            </div>
          </div>
          <VAvatar
            variant="tonal"
            rounded
            size="44"
            class="strip-cell__icon"
          >
            <VIcon
              :icon="item.icon"
              size="26"
            />
          </VAvatar>
        </div>
      </VCol>
    </VRow>
  </VCard>
</template>

<style scoped lang="scss">
.strip-cell__icon {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.strip-cell {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));

  @media (min-width: 1280px) {
    border-block-end: none;
    border-inline-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));

    &--last {
      border-inline-end: none;
    }
  }
}

.strip-cell--last {
  border-block-end: none;
}
</style>
