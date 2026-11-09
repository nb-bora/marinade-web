<!--
  Production : le circuit d'un ticket en trois étapes (en attente → en préparation → prêt),
  la plus longue attente et le détail par poste. Un ticket qui attend trop longtemps fait pulser
  l'étape « en attente ».
-->
<script setup lang="ts">
import { POSTE, duration } from '../format'
import type { RestaurantDashboard } from '../types'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const kitchen = computed(() => props.data?.cuisine)
const busy = computed(() => (kitchen.value?.en_attente ?? 0) + (kitchen.value?.en_preparation ?? 0) + (kitchen.value?.pretes ?? 0) > 0)

const waitColor = computed(() => {
  const wait = kitchen.value?.attente_max_min ?? 0

  return wait > 30 ? 'error' : wait > 15 ? 'warning' : 'success'
})

const late = computed(() => (kitchen.value?.en_attente ?? 0) > 0 && (kitchen.value?.attente_max_min ?? 0) > 15)

const steps = computed(() => [
  { key: 'wait', label: 'En attente', n: kitchen.value?.en_attente ?? 0, color: 'warning', pulse: late.value },
  { key: 'prep', label: 'En préparation', n: kitchen.value?.en_preparation ?? 0, color: 'primary', pulse: false },
  { key: 'ready', label: 'Prêts à servir', n: kitchen.value?.pretes ?? 0, color: 'success', pulse: false },
])
</script>

<template>
  <VCard
    class="h-100"
    data-tour="dash-kitchen"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          color="primary"
          variant="tonal"
          rounded="lg"
        >
          <VIcon icon="ri-restaurant-2-line" />
        </VAvatar>
      </template>
      <VCardTitle>Production</VCardTitle>
      <VCardSubtitle>Cuisine et bar en direct</VCardSubtitle>
      <template #append>
        <VBtn
          variant="text"
          size="small"
          icon="ri-arrow-right-line"
          to="/cuisine"
          aria-label="Ouvrir l'écran cuisine et bar"
        />
      </template>
    </VCardItem>

    <VSkeletonLoader
      v-if="!data"
      type="article"
    />

    <VCardText v-else-if="!busy">
      <AppEmptyState
        icon="ri-checkbox-circle-line"
        title="Rien en production"
        text="Les tickets envoyés en cuisine ou au bar apparaîtront ici."
      />
    </VCardText>

    <VCardText v-else>
      <div class="flow">
        <template
          v-for="(step, i) in steps"
          :key="step.key"
        >
          <div class="flow__step">
            <div
              class="flow__ring tabular-nums"
              :class="[`flow__ring--${step.color}`, { 'flow__ring--pulse': step.pulse }]"
            >
              {{ step.n }}
            </div>
            <div class="text-caption text-medium-emphasis flow__label">
              {{ step.label }}
            </div>
          </div>
          <VIcon
            v-if="i < steps.length - 1"
            icon="ri-arrow-right-s-line"
            class="flow__arrow"
            size="20"
          />
        </template>
      </div>

      <VChip
        v-if="kitchen!.en_attente"
        :color="waitColor"
        variant="tonal"
        size="small"
        label
        prepend-icon="ri-time-line"
        class="mt-4"
      >
        Plus longue attente : {{ duration(kitchen!.attente_max_min) }}
      </VChip>

      <div
        v-if="kitchen!.postes.length > 1"
        class="d-flex justify-space-between text-caption text-medium-emphasis mt-4"
      >
        <span>Par poste</span>
        <span>attente · préparation · prêts</span>
      </div>
      <VList
        v-if="kitchen!.postes.length > 1"
        density="compact"
        class="pa-0"
      >
        <VListItem
          v-for="p in kitchen!.postes"
          :key="p.poste"
          :title="POSTE[p.poste]?.label ?? p.poste"
          class="px-0"
        >
          <template #prepend>
            <VIcon
              :icon="POSTE[p.poste]?.icon ?? 'ri-restaurant-line'"
              size="20"
              class="me-3 text-medium-emphasis"
            />
          </template>
          <template #append>
            <span class="text-body-2 text-medium-emphasis tabular-nums">
              {{ p.en_attente }} · {{ p.en_preparation }} · {{ p.pretes }}
            </span>
          </template>
        </VListItem>
      </VList>
    </VCardText>
  </VCard>
</template>

<style scoped lang="scss">
.flow {
  align-items: flex-start;
  display: grid;
  gap: 0.25rem;
  grid-template-columns: 1fr auto 1fr auto 1fr;
}

.flow__step {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: center;
}

.flow__label {
  line-height: 1.2;
}

.flow__arrow {
  color: rgba(var(--v-theme-on-surface), 0.35);
  margin-top: 1.1rem;
}

.flow__ring {
  align-items: center;
  border: 2px solid currentcolor;
  border-radius: 50%;
  display: flex;
  font-size: 1.5rem;
  font-weight: 700;
  height: 58px;
  justify-content: center;
  width: 58px;

  @each $name in (warning, primary, success) {
    &--#{$name} {
      background: rgba(var(--v-theme-#{$name}), 0.12);
      color: rgb(var(--v-theme-#{$name}));
    }
  }

  &--pulse {
    animation: ring-pulse 1.8s ease-out infinite;
  }
}

@keyframes ring-pulse {
  0% { box-shadow: 0 0 0 0 rgba(var(--v-theme-warning), 0.5); }
  70% { box-shadow: 0 0 0 12px rgba(var(--v-theme-warning), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--v-theme-warning), 0); }
}

@media (prefers-reduced-motion: reduce) {
  .flow__ring--pulse {
    animation: none;
  }
}
</style>
