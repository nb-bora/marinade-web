<!--
  Les places d'une table, une pastille par chaise : pleine si un convive y est assis, en pointillés si
  elle est libre. Même dessin dans la fiche de la table et dans la liste des tables.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  capacity: number

  /** Couverts assis ; `null` ou absent : table sans service, toutes les chaises sont libres. */
  taken?: number | null

  /** Couleur des chaises prises (n'importe quelle couleur CSS) ; par défaut le primaire. */
  color?: string

  /** Au-delà, les chaises en trop se résument en « +n ». */
  max?: number
  size?: 'sm' | 'md'
}>(), { taken: null, color: 'rgb(var(--v-theme-primary))', max: 12, size: 'md' })

const seats = computed(() => Array.from({ length: Math.min(props.capacity, props.max) }, (_, index) => ({ taken: props.taken !== null && index < props.taken })))
const hidden = computed(() => Math.max(0, props.capacity - props.max))
</script>

<template>
  <span
    class="seats"
    :class="`seats--${size}`"
    :style="{ '--seat': color }"
    aria-hidden="true"
  >
    <span
      v-for="(seat, index) in seats"
      :key="index"
      class="seat"
      :class="{ 'seat--taken': seat.taken }"
    />
    <span
      v-if="hidden"
      class="seats__more"
    >+{{ hidden }}</span>
  </span>
</template>

<style scoped>
.seats {
  align-items: center;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 5px;
}

.seat {
  background: transparent;
  block-size: 18px;
  border: 2px dashed rgba(var(--v-theme-on-surface), 0.3);
  border-radius: 50%;
  inline-size: 18px;
}

.seat--taken {
  background: var(--seat);
  border: 2px solid var(--seat);
}

.seats--sm {
  gap: 4px;
}

.seats--sm .seat {
  block-size: 13px;
  border-width: 1.5px;
  inline-size: 13px;
}

.seats__more {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
}
</style>
