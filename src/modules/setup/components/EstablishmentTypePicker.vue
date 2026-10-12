<!--
  Choix du type d'établissement à la création : restaurant ou pressing. Le type se fixe à la création
  et ne se modifie plus ensuite, ce que le texte d'aide rappelle.
-->
<script setup lang="ts">
import type { EstablishmentType } from '@/lib/module/types'

const OPTIONS: Array<{ value: EstablishmentType; title: string; text: string; icon: string }> = [
  {
    value: 'restaurant',
    title: 'Restaurant',
    text: 'Carte, salle et tables, cuisine, caisse, stock et réservations.',
    icon: 'ri-restaurant-2-line',
  },
  {
    value: 'pressing',
    title: 'Pressing',
    text: 'Machines et plan du local, tarifs au kilo, articles et commandes de linge.',
    icon: 'ri-t-shirt-air-line',
  },
]

const type = defineModel<EstablishmentType>({ required: true })
</script>

<template>
  <div>
    <div
      id="establishment-type-label"
      class="text-subtitle-2 mb-2"
    >
      Type d'établissement
    </div>
    <div
      class="establishment-picker"
      role="group"
      aria-labelledby="establishment-type-label"
    >
      <button
        v-for="option in OPTIONS"
        :key="option.value"
        type="button"
        class="establishment-card"
        :class="{ 'establishment-card--active': type === option.value }"
        :aria-pressed="type === option.value"
        :data-testid="`type-${option.value}`"
        @click="type = option.value"
      >
        <VAvatar
          :color="type === option.value ? 'primary' : 'secondary'"
          :variant="type === option.value ? 'flat' : 'tonal'"
          rounded
          size="44"
        >
          <VIcon
            :icon="option.icon"
            size="24"
          />
        </VAvatar>
        <span class="establishment-card__text">
          <span class="d-block text-subtitle-1 font-weight-semibold">{{ option.title }}</span>
          <span class="d-block text-body-2 text-medium-emphasis">{{ option.text }}</span>
        </span>
        <VIcon
          :icon="type === option.value ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"
          :color="type === option.value ? 'primary' : undefined"
          class="establishment-card__check"
          size="22"
        />
      </button>
    </div>
    <p class="text-caption text-medium-emphasis mt-2 mb-0">
      Ce choix est définitif : le type d'établissement ne peut plus être modifié après la création.
    </p>
  </div>
</template>

<style scoped>
.establishment-picker {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 12px;
}

.establishment-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  text-align: start;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.establishment-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.6);
}

.establishment-card--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.07);
  box-shadow: 0 0 0 1px rgb(var(--v-theme-primary));
}

.establishment-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.establishment-card__text {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.establishment-card__check {
  flex: none;
}
</style>
