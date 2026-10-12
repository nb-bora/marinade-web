<!-- Tuile colorée d'un groupe d'états de machines : icône, effectif et libellé. Cliquable si `to` est fourni. -->
<script setup lang="ts">
const props = defineProps<{
  label: string
  count: number
  icon: string

  /** Couleur du thème Vuetify ou valeur hexadécimale. */
  color: string
  to?: string
  loading?: boolean
}>()

const tint = computed(() => props.color.startsWith('#') ? props.color : `rgb(var(--v-theme-${props.color}))`)
</script>

<template>
  <component
    :is="to ? 'RouterLink' : 'div'"
    class="state-tile d-flex align-center gap-3 pa-4"
    :class="{ 'state-tile--link': !!to }"
    :style="{ '--tint': tint }"
    v-bind="to ? { to } : {}"
  >
    <VAvatar
      rounded
      size="44"
      class="state-tile__icon"
    >
      <VIcon
        :icon="icon"
        size="26"
      />
    </VAvatar>
    <div class="min-w-0">
      <VSkeletonLoader
        v-if="loading"
        type="heading"
        width="48"
        class="bg-transparent"
      />
      <div
        v-else
        class="text-h4 font-weight-semibold tabular-nums"
      >
        {{ count }}
      </div>
      <div class="text-body-2 text-medium-emphasis">
        {{ label }}
      </div>
    </div>
  </component>
</template>

<style scoped>
.state-tile {
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--tint) 35%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--tint) 9%, rgb(var(--v-theme-surface)));
  color: inherit;
  text-decoration: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.state-tile::before {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  inline-size: 4px;
  background: var(--tint);
}

.state-tile__icon {
  background: color-mix(in srgb, var(--tint) 18%, transparent);
  color: var(--tint);
}

.state-tile--link:hover,
.state-tile--link:focus-visible {
  border-color: var(--tint);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--tint) 22%, transparent);
  outline: none;
  transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .state-tile {
    transition: none;
  }

  .state-tile--link:hover,
  .state-tile--link:focus-visible {
    transform: none;
  }
}
</style>
