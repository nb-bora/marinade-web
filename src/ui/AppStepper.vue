<!-- Étapes numérotées d'un assistant (01 Compte — 02 Restaurant — 03 Confirmation). -->
<script setup lang="ts">
defineProps<{
  steps: { title: string; subtitle?: string }[]

  /** Index de l'étape courante (à partir de 0). */
  current: number
}>()
</script>

<template>
  <ol
    class="app-stepper"
    aria-label="Étapes"
  >
    <li
      v-for="(step, index) in steps"
      :key="step.title"
      class="app-stepper__step"
      :class="{
        'app-stepper__step--done': index < current,
        'app-stepper__step--active': index === current,
      }"
      :aria-current="index === current ? 'step' : undefined"
    >
      <span class="app-stepper__dot">
        <VIcon
          v-if="index < current"
          icon="ri-check-line"
          size="14"
        />
      </span>
      <span class="app-stepper__number">{{ String(index + 1).padStart(2, '0') }}</span>
      <span class="app-stepper__text">
        <span class="app-stepper__title">{{ step.title }}</span>
        <span
          v-if="step.subtitle"
          class="app-stepper__subtitle"
        >{{ step.subtitle }}</span>
      </span>
      <span
        v-if="index < steps.length - 1"
        class="app-stepper__line"
        aria-hidden="true"
      />
    </li>
  </ol>
</template>

<style scoped lang="scss">
.app-stepper {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 0;
  padding: 0;
  margin: 0;
  list-style: none;
}

.app-stepper__step {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 0.5rem;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}

.app-stepper__dot {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(var(--v-theme-primary), 0.25);
  border-radius: 50%;
  block-size: 1.25rem;
  inline-size: 1.25rem;
}

.app-stepper__number {
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1;
}

.app-stepper__text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.app-stepper__title {
  font-size: 0.9375rem;
  font-weight: 500;
}

.app-stepper__subtitle {
  font-size: 0.8125rem;
}

.app-stepper__line {
  flex: 1 1 1.5rem;
  min-inline-size: 1.5rem;
  margin-inline: 0.75rem;
  block-size: 1px;
  background: rgba(var(--v-theme-primary), 0.25);
}

.app-stepper__step--active,
.app-stepper__step--done {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));

  .app-stepper__dot {
    border-color: rgb(var(--v-theme-primary));
  }

  .app-stepper__subtitle {
    color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  }
}

.app-stepper__step--done {
  .app-stepper__dot {
    border-width: 0;
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
  }

  .app-stepper__line {
    background: rgb(var(--v-theme-primary));
  }
}

@media (max-width: 599px) {
  .app-stepper__subtitle,
  .app-stepper__number {
    display: none;
  }
}
</style>
