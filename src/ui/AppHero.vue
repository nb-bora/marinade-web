<!--
  Bandeau de tête d'un écran « temps réel » : étiquette en majuscules (avec un point vert qui
  pulse quand `live`), grand titre, sous-titre et zone d'actions. Même grammaire que le tableau
  de bord : dégradé orange discret et trame de points.
-->
<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  subtitle?: string

  /** Écran actualisé en continu : le point pulse, sinon il est gris. */
  live?: boolean
}>()
</script>

<template>
  <header class="hero">
    <div class="hero__main min-w-0">
      <div
        v-if="eyebrow"
        class="hero__eyebrow"
      >
        <span
          class="hero__dot"
          :class="{ 'hero__dot--live': live }"
        />
        <span>{{ eyebrow }}</span>
        <span class="hero__extra"><slot name="eyebrow-extra" /></span>
      </div>
      <h1 class="hero__title">
        {{ title }}
      </h1>
      <p
        v-if="subtitle"
        class="hero__subtitle"
      >
        {{ subtitle }}
      </p>
    </div>

    <div
      v-if="$slots.actions"
      class="hero__actions"
    >
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped lang="scss">
.hero {
  align-items: center;
  background:
    radial-gradient(circle at 12% 0%, rgba(var(--v-theme-primary), 0.2), transparent 55%),
    linear-gradient(135deg, rgba(var(--v-theme-primary), 0.1), rgba(var(--v-theme-primary), 0.02) 70%),
    rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-primary), 0.22);
  border-radius: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem 2rem;
  justify-content: space-between;
  overflow: hidden;
  padding: 1.5rem 1.75rem;
  position: relative;

  &::before {
    background-image: radial-gradient(rgba(var(--v-theme-on-surface), 0.12) 1px, transparent 1px);
    background-size: 16px 16px;
    content: '';
    inset: 0;
    -webkit-mask-image: linear-gradient(90deg, transparent 30%, #000 100%);
    mask-image: linear-gradient(90deg, transparent 30%, #000 100%);
    opacity: 0.55;
    pointer-events: none;
    position: absolute;
  }

  > * {
    position: relative;
  }
}

.hero__eyebrow {
  align-items: center;
  color: rgb(var(--v-theme-primary));
  display: flex;
  flex-wrap: wrap;
  font-size: 0.75rem;
  font-weight: 600;
  gap: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.hero__extra {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: none;

  &:empty {
    display: none;
  }
}

.hero__title {
  font-size: clamp(1.5rem, 1.2rem + 1.2vw, 2.1rem);
  font-weight: 700;
  line-height: 1.2;
  margin-block: 0.35rem 0.2rem;
}

.hero__subtitle {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  margin: 0;
}

.hero__main {
  flex: 2 1 320px;
}

/* Les actions restent à droite du titre et passent sur deux rangées si besoin, au lieu de tomber dessous. */
.hero__actions {
  align-items: center;
  display: flex;
  flex: 1 1 380px;
  flex-wrap: wrap;
  gap: 0.6rem;
  justify-content: flex-end;
}

.hero__dot {
  background: rgba(var(--v-theme-on-surface), 0.35);
  border-radius: 50%;
  height: 9px;
  width: 9px;

  &--live {
    animation: hero-pulse 2s ease-out infinite;
    background: rgb(var(--v-theme-success));
  }
}

@keyframes hero-pulse {
  0% { box-shadow: 0 0 0 0 rgba(var(--v-theme-success), 0.55); }
  70% { box-shadow: 0 0 0 9px rgba(var(--v-theme-success), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--v-theme-success), 0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero__dot--live {
    animation: none;
  }
}

@media (max-width: 599px) {
  .hero {
    padding: 1.15rem 1.1rem;
  }

  .hero__actions {
    justify-content: flex-start;
  }
}
</style>
