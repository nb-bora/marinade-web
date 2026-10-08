<script setup lang="ts">
import { useFloorData } from '../composables/useFloorData'
import { plural } from '../labels'
import { tableState } from '../service'
import { useLive } from '@/composables/useLive'

// Sans les factures : le widget ne coûte que deux requêtes.
const { data, loading, error, reload, refresh } = useFloorData(false)

useLive(refresh)

const views = computed(() => data.value?.views ?? [])
const free = computed(() => views.value.filter(view => tableState(view) === 'libre').length)
const occupied = computed(() => views.value.filter(view => view.session).length)
const covers = computed(() => views.value.reduce((sum, view) => sum + (view.session ? view.covers ?? 0 : 0), 0))
const occupancy = computed(() => views.value.length ? Math.round(occupied.value / views.value.length * 100) : 0)
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Salle</VCardTitle>
      <VCardSubtitle>
        <span class="font-weight-medium text-high-emphasis">{{ plural(views.length, 'table') }}</span>
        · mis à jour en continu
      </VCardSubtitle>
      <template #append>
        <VBtn
          to="/salle"
          variant="text"
          size="small"
          append-icon="ri-arrow-right-line"
        >
          Plan de salle
        </VBtn>
      </template>
    </VCardItem>

    <VCardText class="pt-4">
      <AppErrorState
        v-if="error && !data"
        :error="error"
        @retry="reload"
      />
      <template v-else>
        <VRow>
          <VCol cols="6">
            <AppStatTile
              label="Tables libres"
              icon="ri-checkbox-circle-line"
              color="success"
              :loading="loading && !data"
              :value="String(free)"
            />
          </VCol>
          <VCol cols="6">
            <AppStatTile
              label="Tables occupées"
              icon="ri-restaurant-2-line"
              color="error"
              :loading="loading && !data"
              :value="String(occupied)"
            />
          </VCol>
          <VCol cols="12">
            <AppStatTile
              label="Couverts en salle"
              icon="ri-group-line"
              color="info"
              :loading="loading && !data"
              :value="String(covers)"
            />
          </VCol>
        </VRow>

        <div
          v-if="data && views.length"
          class="mt-5"
        >
          <div class="d-flex justify-space-between text-body-2 text-medium-emphasis mb-1">
            <span>Taux d'occupation</span>
            <span class="tabular-nums">{{ occupancy }} %</span>
          </div>
          <VProgressLinear
            :model-value="occupancy"
            color="primary"
            rounded
            height="8"
            aria-label="Taux d'occupation de la salle"
          />
        </div>
      </template>
    </VCardText>
  </VCard>
</template>
