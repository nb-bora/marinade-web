<!--
  Étapes d'un assistant, en ligne : une icône, son libellé dessous, un chevron entre deux étapes.
  Étape en cours en couleur primaire, étapes terminées cochées (et cliquables pour revenir),
  étapes à venir atténuées. Sur mobile, seul le libellé de l'étape en cours reste affiché.
-->
<script setup lang="ts">
defineProps<{
  steps: { title: string; icon: string }[]

  /** Index de l'étape courante (à partir de 0). */
  current: number
}>()

defineEmits<{ select: [index: number] }>()
</script>

<template>
  <nav
    class="wizard-stepper"
    aria-label="Progression de l'inscription"
  >
    <ol class="wizard-stepper__list">
      <template
        v-for="(step, index) in steps"
        :key="step.title"
      >
        <li
          class="wizard-stepper__item"
          :class="{
            'wizard-stepper__item--done': index < current,
            'wizard-stepper__item--active': index === current,
          }"
          :aria-current="index === current ? 'step' : undefined"
        >
          <component
            :is="index < current ? 'button' : 'div'"
            :type="index < current ? 'button' : undefined"
            class="wizard-stepper__step"
            :aria-label="index < current ? `Revenir à l'étape ${step.title}` : undefined"
            @click="index < current && $emit('select', index)"
          >
            <span class="wizard-stepper__icon">
              <VIcon
                :icon="step.icon"
                size="30"
              />
              <span
                v-if="index < current"
                class="wizard-stepper__check"
                aria-hidden="true"
              >
                <VIcon
                  icon="ri-check-line"
                  size="12"
                />
              </span>
            </span>
            <span class="wizard-stepper__label">{{ step.title }}</span>
          </component>
          <span
            v-if="index === current"
            class="d-sr-only"
          >
            , étape {{ index + 1 }} sur {{ steps.length }}
          </span>
        </li>

        <li
          v-if="index < steps.length - 1"
          class="wizard-stepper__chevron"
          :class="{ 'wizard-stepper__chevron--done': index < current }"
          aria-hidden="true"
        >
          <VIcon
            icon="ri-arrow-right-s-line"
            size="20"
          />
        </li>
      </template>
    </ol>

    <!-- Mobile : les libellés ne tiennent pas, on n'affiche que celui de l'étape en cours. -->
    <p
      class="wizard-stepper__current"
      aria-hidden="true"
    >
      {{ steps[current]?.title }}
    </p>
  </nav>
</template>

<style scoped lang="scss">
.wizard-stepper {
  padding-block: 0.25rem 1.5rem;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.wizard-stepper__list {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wizard-stepper__item {
  display: flex;
  flex: 1 1 0;
  justify-content: center;
  min-inline-size: 0;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.wizard-stepper__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border: 0;
  border-radius: 10px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: center;
}

button.wizard-stepper__step {
  cursor: pointer;

  &:hover .wizard-stepper__icon { transform: translateY(-2px); }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }
}

.wizard-stepper__icon {
  position: relative;
  display: grid;
  place-items: center;
  transition: transform 0.15s ease, color 0.15s ease;
}

.wizard-stepper__label {
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
}

.wizard-stepper__current {
  display: none;
  margin: 0.75rem 0 0;
  color: rgb(var(--v-theme-primary));
  font-size: 0.9375rem;
  font-weight: 700;
  text-align: center;
}

.wizard-stepper__chevron {
  display: flex;
  flex: none;
  align-items: center;
  block-size: 2.25rem;
  color: rgba(var(--v-theme-on-surface), 0.4);

  &--done { color: rgb(var(--v-theme-primary)); }
}

.wizard-stepper__item--active {
  color: rgb(var(--v-theme-primary));

  .wizard-stepper__label { font-weight: 700; }
}

.wizard-stepper__item--done {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));

  .wizard-stepper__icon { color: rgb(var(--v-theme-primary)); }
}

.wizard-stepper__check {
  position: absolute;
  display: grid;
  place-items: center;
  border: 2px solid rgb(var(--v-theme-surface));
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  block-size: 1.125rem;
  inline-size: 1.125rem;
  inset-block-start: -0.25rem;
  inset-inline-end: -0.5rem;
}

.d-sr-only {
  position: absolute;
  overflow: hidden;
  block-size: 1px;
  inline-size: 1px;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 599px) {
  .wizard-stepper__label { display: none; }
  .wizard-stepper__step { padding-inline: 0.125rem; }
  .wizard-stepper__current { display: block; }
}

@media (prefers-reduced-motion: reduce) {
  .wizard-stepper__icon { transition: none; }
}
</style>
