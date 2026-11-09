<!-- Réservations du jour : volume, couverts, à confirmer et prochaines arrivées. -->
<script setup lang="ts">
import { RESERVATION_STATUT, clock, plural } from '../format'
import type { RestaurantDashboard } from '../types'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const res = computed(() => props.data?.reservations)
</script>

<template>
  <VCard
    class="h-100"
    data-tour="dash-reservations"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          color="info"
          variant="tonal"
          rounded="lg"
        >
          <VIcon icon="ri-calendar-check-line" />
        </VAvatar>
      </template>
      <VCardTitle>Réservations</VCardTitle>
      <VCardSubtitle v-if="res">
        {{ res.total_jour }} aujourd'hui · {{ plural(res.couverts_jour, 'couvert') }}
      </VCardSubtitle>
      <template #append>
        <VBtn
          variant="text"
          size="small"
          icon="ri-arrow-right-line"
          to="/reservations"
          aria-label="Ouvrir l'agenda des réservations"
        />
      </template>
    </VCardItem>

    <VSkeletonLoader
      v-if="!data"
      type="list-item-two-line, list-item-two-line"
    />

    <VCardText v-else-if="!res?.prochaines.length">
      <AppEmptyState
        icon="ri-calendar-line"
        title="Aucune arrivée à venir"
        text="Les prochaines réservations du jour s'afficheront ici."
      />
    </VCardText>

    <template v-else>
      <VAlert
        v-if="res.a_confirmer"
        type="warning"
        variant="tonal"
        density="compact"
        class="mx-4 mb-2"
        icon="ri-alert-line"
      >
        {{ plural(res.a_confirmer, 'réservation') }} à confirmer
      </VAlert>
      <VList
        lines="two"
        class="py-0"
      >
        <VListItem
          v-for="r in res.prochaines"
          :key="r.id"
          :title="r.nom"
          :subtitle="`${plural(r.couverts, 'personne')}${r.table ? ` · Table ${r.table}` : ''}`"
          to="/reservations"
        >
          <template #prepend>
            <div class="time text-subtitle-2 font-weight-semibold tabular-nums me-3">
              {{ clock(r.heure, data.fuseau) }}
            </div>
          </template>
          <template #append>
            <VChip
              :color="RESERVATION_STATUT[r.statut]?.color ?? 'secondary'"
              size="small"
              variant="tonal"
              label
            >
              {{ RESERVATION_STATUT[r.statut]?.label ?? r.statut }}
            </VChip>
          </template>
        </VListItem>
      </VList>
    </template>
  </VCard>
</template>

<style scoped>
.time {
  background: rgba(var(--v-theme-primary), 0.12);
  border-radius: 8px;
  color: rgb(var(--v-theme-primary));
  padding: 0.35rem 0.6rem;
}
</style>
