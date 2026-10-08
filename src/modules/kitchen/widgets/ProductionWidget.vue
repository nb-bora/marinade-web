<script setup lang="ts">
import { kitchenApi } from '../api'
import { STATIONS } from '../labels'
import type { Station } from '../types'
import { useLive } from '@/composables/useLive'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()

const counts = ref<Record<Station, number> | null>(null)
const error = ref<unknown>(null)

async function load() {
  const id = tenant.currentId

  if (!id)
    return

  try {
    const results = await Promise.all(STATIONS.map(item => kitchenApi.pending(id, item.value)))

    counts.value = Object.fromEntries(
      STATIONS.map((item, index) => [item.value, results[index].length]),
    ) as Record<Station, number>
    error.value = null
  }
  catch (cause) {
    if (!counts.value)
      error.value = cause
  }
}

useLive(load)
watch(() => tenant.currentId, () => {
  counts.value = null
  load()
})

const total = computed(() => STATIONS.reduce((sum, item) => sum + (counts.value?.[item.value] ?? 0), 0))
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Production</VCardTitle>
      <VCardSubtitle>Commandes en attente par poste</VCardSubtitle>
      <template #append>
        <VBtn
          to="/cuisine"
          variant="text"
          size="small"
          append-icon="ri-arrow-right-line"
        >
          Ouvrir
        </VBtn>
      </template>
    </VCardItem>

    <VCardText>
      <AppErrorState
        v-if="error"
        :error="error"
        @retry="load"
      />

      <VSkeletonLoader
        v-else-if="!counts"
        type="list-item-avatar@3"
      />

      <template v-else>
        <ul class="stations">
          <li
            v-for="item in STATIONS"
            :key="item.value"
            class="d-flex align-center gap-3"
          >
            <VAvatar
              color="primary"
              variant="tonal"
              rounded
            >
              <VIcon :icon="item.icon" />
            </VAvatar>
            <span class="text-body-1 font-weight-medium">{{ item.title }}</span>
            <VSpacer />
            <span
              class="text-h5 font-weight-semibold tabular-nums"
              :class="counts[item.value] > 0 ? 'text-primary' : 'text-disabled'"
            >
              {{ counts[item.value] }}
            </span>
          </li>
        </ul>

        <p class="text-body-2 text-medium-emphasis mb-0 mt-4">
          {{ total === 0 ? 'Tout est à jour, rien en attente.' : `${total} commande${total > 1 ? 's' : ''} à préparer ou en préparation.` }}
        </p>
      </template>
    </VCardText>
  </VCard>
</template>

<style scoped>
.stations {
  display: grid;
  gap: 1rem;
  padding: 0;
  list-style: none;
}
</style>
