<!-- Ce qui demande une action maintenant : cuisine qui attend, stock, réservations, caisse. -->
<script setup lang="ts">
import { ALERTE_NIVEAU } from '../format'
import type { RestaurantDashboard } from '../types'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const alerts = computed(() => props.data?.alertes ?? [])
const critical = computed(() => alerts.value.filter(a => a.niveau === 'critique').length)

const subtitle = computed(() => !props.data
  ? 'Chargement…'
  : alerts.value.length ? `${alerts.value.length} point${alerts.value.length > 1 ? 's' : ''} d'attention` : 'Rien d\'urgent')
</script>

<template>
  <VCard
    class="h-100"
    data-tour="dash-alerts"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          :color="critical ? 'error' : alerts.length ? 'warning' : 'success'"
          variant="tonal"
          rounded="lg"
        >
          <VIcon :icon="alerts.length ? 'ri-notification-3-line' : 'ri-shield-check-line'" />
        </VAvatar>
      </template>
      <VCardTitle>À traiter</VCardTitle>
      <VCardSubtitle>{{ subtitle }}</VCardSubtitle>
      <template
        v-if="critical"
        #append
      >
        <VChip
          color="error"
          size="small"
          variant="flat"
          label
          class="alert-badge"
        >
          {{ critical }} critique{{ critical > 1 ? 's' : '' }}
        </VChip>
      </template>
    </VCardItem>

    <VSkeletonLoader
      v-if="!data"
      type="list-item-two-line, list-item-two-line"
    />

    <VCardText v-else-if="!alerts.length">
      <div class="d-flex flex-column align-center text-center pa-4 gap-2">
        <VAvatar
          color="success"
          variant="tonal"
          size="64"
        >
          <VIcon
            icon="ri-checkbox-circle-line"
            size="34"
          />
        </VAvatar>
        <div class="text-subtitle-1 font-weight-medium">
          Tout est sous contrôle
        </div>
        <div class="text-body-2 text-medium-emphasis">
          Cuisine fluide, stock suffisant, aucune réservation à confirmer.
        </div>
      </div>
    </VCardText>

    <div
      v-else
      class="alerts"
    >
      <component
        :is="alert.lien ? 'RouterLink' : 'div'"
        v-for="alert in alerts"
        :key="alert.type"
        v-bind="alert.lien ? { to: alert.lien } : {}"
        class="alert"
        :class="`alert--${alert.niveau}`"
      >
        <VAvatar
          :color="ALERTE_NIVEAU[alert.niveau]?.color ?? 'info'"
          variant="tonal"
          size="34"
          rounded="lg"
        >
          <VIcon
            :icon="ALERTE_NIVEAU[alert.niveau]?.icon ?? 'ri-information-line'"
            size="19"
          />
        </VAvatar>
        <span class="alert__text">{{ alert.message }}</span>
        <VIcon
          v-if="alert.lien"
          icon="ri-arrow-right-s-line"
          size="20"
          class="text-medium-emphasis"
        />
      </component>
    </div>
  </VCard>
</template>

<style scoped lang="scss">
.alerts {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 1rem 1rem;
}

.alert {
  align-items: center;
  background: rgba(var(--v-theme-on-surface), 0.035);
  border-inline-start: 3px solid transparent;
  border-radius: 12px;
  color: inherit;
  display: flex;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  text-decoration: none;
  transition: background 0.15s ease;

  &:is(a):hover {
    background: rgba(var(--v-theme-on-surface), 0.07);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }

  &--critique { border-inline-start-color: rgb(var(--v-theme-error)); }
  &--avertissement { border-inline-start-color: rgb(var(--v-theme-warning)); }
  &--info { border-inline-start-color: rgb(var(--v-theme-info)); }
}

.alert__text {
  flex: 1;
  font-size: 0.9rem;
  line-height: 1.35;
  min-width: 0;
}

.alert-badge {
  animation: badge-pulse 2s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@media (prefers-reduced-motion: reduce) {
  .alert-badge {
    animation: none;
  }
}
</style>
