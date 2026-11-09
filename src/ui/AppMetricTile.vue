<!--
  Tuile d'indicateur façon « cockpit » : libellé, pastille d'icône, grande valeur (slot), indication
  et jauge facultative. `hero` la met en avant (dégradé orange). Pensée pour être posée dans une
  grille (`.metric-tiles`) : la tuile remplit la hauteur de sa cellule.
-->
<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  icon: string
  color?: 'primary' | 'success' | 'info' | 'warning' | 'error' | 'secondary'
  hero?: boolean
  hint?: string

  /** Jauge de 0 à 100 sous la valeur. */
  gauge?: number
  gaugeLabel?: string
  to?: string
}>(), { color: 'primary' })
</script>

<template>
  <component
    :is="to ? 'RouterLink' : 'div'"
    v-bind="to ? { to } : {}"
    class="tile-link"
  >
    <VCard
      class="tile h-100"
      :class="{ 'tile--hero': hero }"
    >
      <div class="tile__body">
        <div class="d-flex align-center justify-space-between gap-3">
          <span class="tile__label">{{ label }}</span>
          <VAvatar
            :color="hero ? undefined : color"
            :variant="hero ? 'flat' : 'tonal'"
            :class="{ 'tile__avatar--hero': hero }"
            rounded="lg"
            size="34"
          >
            <VIcon
              :icon="icon"
              size="19"
            />
          </VAvatar>
        </div>

        <div class="tile__value tabular-nums">
          <slot />
        </div>

        <div
          v-if="hint || $slots.hint"
          class="tile__hint"
        >
          <slot name="hint">
            {{ hint }}
          </slot>
        </div>
      </div>

      <div
        v-if="gauge !== undefined"
        class="tile__gauge"
        :title="gaugeLabel"
      >
        <VProgressLinear
          :model-value="gauge"
          :color="hero ? 'white' : color"
          height="6"
          rounded
          bg-opacity="0.2"
        />
      </div>
    </VCard>
  </component>
</template>

<style scoped lang="scss">
.tile-link {
  color: inherit;
  display: block;
  text-decoration: none;

  &:is(a):hover .tile {
    border-color: rgba(var(--v-theme-primary), 0.45);
    box-shadow: 0 8px 24px -10px rgba(var(--v-theme-primary), 0.45) !important;
    transform: translateY(-2px);
  }

  &:focus-visible {
    border-radius: 16px;
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }
}

.tile {
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.tile--hero {
  background:
    radial-gradient(circle at 90% -10%, rgba(255, 255, 255, 0.28), transparent 55%),
    linear-gradient(135deg, rgb(var(--v-theme-primary)), #b8470a) !important;
  border-color: transparent !important;
  color: #fff;
}

.tile__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.3rem;
  padding: 1rem 1.1rem 0.75rem;
}

.tile__label {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tile__value {
  font-size: clamp(1.4rem, 1rem + 0.9vw, 1.75rem);
  font-weight: 700;
  line-height: 1.2;
  margin-top: 0.2rem;
  white-space: nowrap;
}

.tile__value :deep(.unit) {
  font-size: 0.5em;
  font-weight: 500;
  margin-inline-start: 0.35em;
  opacity: 0.7;
}

.tile__hint {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
  margin-top: auto;
  padding-top: 0.2rem;
}

.tile--hero .tile__label,
.tile--hero .tile__hint {
  color: rgba(255, 255, 255, 0.85);
}

.tile__gauge {
  padding: 0 1.1rem 1.05rem;
}

.tile__avatar--hero {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

@media (prefers-reduced-motion: reduce) {
  .tile,
  .tile-link:is(a):hover .tile {
    transform: none;
    transition: none;
  }
}
</style>
