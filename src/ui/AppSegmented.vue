<!--
  Contrôle segmenté (une seule valeur parmi quelques-unes) : périodes, vues, filtres rapides.
  Accessible comme un groupe de boutons radio : flèches gauche/droite pour changer.
-->
<script setup lang="ts" generic="T extends string | number">
const props = defineProps<{
  options: { value: T; title: string }[]
  label: string
}>()

const model = defineModel<T>({ required: true })

function move(step: number) {
  const index = props.options.findIndex(option => option.value === model.value)
  const next = props.options[(index + step + props.options.length) % props.options.length]

  model.value = next.value
}
</script>

<template>
  <div
    class="app-segmented"
    role="radiogroup"
    :aria-label="label"
    @keydown.right.prevent="move(1)"
    @keydown.left.prevent="move(-1)"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="app-segmented__item"
      :class="{ 'app-segmented__item--active': option.value === model }"
      :aria-checked="option.value === model"
      :tabindex="option.value === model ? 0 : -1"
      @click="model = option.value"
    >
      {{ option.title }}
    </button>
  </div>
</template>

<style scoped>
.app-segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
}

.app-segmented__item {
  padding-block: 6px;
  padding-inline: 14px;
  border-radius: 7px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
  white-space: nowrap;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.app-segmented__item:hover {
  background: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
}

.app-segmented__item--active,
.app-segmented__item--active:hover {
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.app-segmented__item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}

@media (pointer: coarse) {
  .app-segmented__item {
    padding-block: 10px;
  }
}
</style>
