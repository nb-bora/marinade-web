<script setup lang="ts">
import { platformApi } from '../api'
import SubscriptionDrawer from '../components/SubscriptionDrawer.vue'
import SubscriptionFormDialog from '../components/SubscriptionFormDialog.vue'
import { useTrackedSubscriptions } from '../composables/useTrackedSubscriptions'
import { presentSubscriptionStatus } from '../labels'
import type { Subscription } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { useSubmit } from '@/composables/useSubmit'
import { formatDate } from '@/lib/format'

const tracked = useTrackedSubscriptions()
const { data: tiersData, error: tiersError, reload: reloadTiers } = useAsyncData(signal => platformApi.tiers(signal))
const tiers = computed(() => tiersData.value ?? [])
const tierName = (id: number) => tiers.value.find(tier => tier.id === id)?.name ?? 'Offre inconnue'

const sorted = computed(() => [...tracked.items.value].sort((a, b) => b.subscription.created_at.localeCompare(a.subscription.created_at)))
const { page, pageSize, total, pages, rows, hasNext } = useClientPagination(sorted, 10)

const selectedId = ref<string | null>(null)
const createDialog = ref(false)

// Ouvrir un abonnement par son identifiant
const lookupId = ref('')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const lookupRules = [(value: string) => value.trim() === '' || UUID.test(value.trim()) || 'Un identifiant ressemble à 3fa85f64-5717-4562-b3fc-2c963f66afa6.']

const lookup = useSubmit(async () => {
  const id = lookupId.value.trim().toLowerCase()

  if (!UUID.test(id))
    return

  await platformApi.subscription(id)
  tracked.track(id)
  lookupId.value = ''
  await tracked.reload()
  selectedId.value = id
})

async function created(subscription: Subscription) {
  tracked.track(subscription.id)
  await tracked.reload()
  selectedId.value = subscription.id
}

async function forget(id: string) {
  tracked.forget(id)
  await tracked.reload()
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Abonnements"
      subtitle="Abonnez un restaurant à une offre, suivez son statut et ses soldes quotidiens."
    >
      <template #actions>
        <VBtn
          prepend-icon="ri-add-line"
          :disabled="tiers.length === 0"
          @click="createDialog = true"
        >
          Nouvel abonnement
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="tiersError && tiersData === null"
      class="mb-6"
      :error="tiersError"
      @retry="reloadTiers"
    />

    <VAlert
      type="info"
      variant="tonal"
      class="mb-6"
    >
      Le serveur ne fournit pas la liste de tous les abonnements. Cette page suit ceux que vous
      créez ou ouvrez depuis ce navigateur.
    </VAlert>

    <VCard>
      <VCardItem class="pb-2">
        <VCardTitle>Ouvrir un abonnement</VCardTitle>
        <VCardSubtitle>Collez l'identifiant d'un abonnement existant pour le suivre ici.</VCardSubtitle>
      </VCardItem>
      <VCardText>
        <VForm
          validate-on="submit"
          class="d-flex flex-wrap align-start gap-3"
          @submit.prevent="lookup.submit()"
        >
          <VTextField
            v-model="lookupId"
            label="Identifiant de l'abonnement"
            placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
            prepend-inner-icon="ri-search-line"
            :rules="lookupRules"
            :error-messages="lookup.message.value"
            autocomplete="off"
            class="lookup-field"
          />
          <VBtn
            type="submit"
            variant="tonal"
            size="large"
            :loading="lookup.pending.value"
            :disabled="lookupId.trim() === ''"
          >
            Ouvrir
          </VBtn>
        </VForm>
      </VCardText>
    </VCard>

    <VCard class="mt-6">
      <VCardItem class="pb-2">
        <VCardTitle>Abonnements suivis</VCardTitle>
      </VCardItem>

      <VDivider />

      <AppErrorState
        v-if="tracked.error.value && !tracked.loaded.value"
        class="ma-4"
        :error="tracked.error.value"
        @retry="tracked.reload()"
      />

      <VSkeletonLoader
        v-else-if="!tracked.loaded.value"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="sorted.length === 0"
        icon="ri-vip-crown-line"
        title="Aucun abonnement suivi"
        text="Créez un abonnement pour un restaurant, ou ouvrez-en un avec son identifiant."
      >
        <VBtn
          :disabled="tiers.length === 0"
          @click="createDialog = true"
        >
          Nouvel abonnement
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable hover>
          <thead>
            <tr>
              <th>Restaurant</th>
              <th>Statut</th>
              <th class="d-none d-md-table-cell">
                Offre
              </th>
              <th class="d-none d-md-table-cell">
                Début
              </th>
              <th class="d-none d-lg-table-cell">
                Fin
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in rows"
              :key="item.subscription.id"
              class="cursor-pointer"
              tabindex="0"
              @click="selectedId = item.subscription.id"
              @keydown.enter="selectedId = item.subscription.id"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    rounded
                    size="38"
                  >
                    <VIcon icon="ri-store-2-line" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate name-cell">
                      {{ item.restaurantName }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis d-md-none">
                      {{ tierName(item.subscription.tier_id) }}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <AppStatusChip
                  :label="presentSubscriptionStatus(item.subscription.status).label"
                  :tone="presentSubscriptionStatus(item.subscription.status).tone"
                  :icon="presentSubscriptionStatus(item.subscription.status).icon"
                />
              </td>
              <td class="d-none d-md-table-cell text-high-emphasis">
                {{ tierName(item.subscription.tier_id) }}
              </td>
              <td class="d-none d-md-table-cell text-medium-emphasis text-no-wrap">
                {{ formatDate(item.subscription.start_date) }}
              </td>
              <td class="d-none d-lg-table-cell text-medium-emphasis text-no-wrap">
                {{ item.subscription.end_date ? formatDate(item.subscription.end_date) : 'Sans fin' }}
              </td>
            </tr>
          </tbody>
        </VTable>

        <VDivider />

        <AppTablePagination
          :page="page"
          :page-size="pageSize"
          :count="rows.length"
          :total="total"
          :pages="pages"
          :has-next="hasNext"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </template>
    </VCard>

    <SubscriptionFormDialog
      v-model="createDialog"
      :tiers="tiers"
      @saved="created"
    />

    <SubscriptionDrawer
      v-model="selectedId"
      :entries="tracked.items.value"
      :tiers="tiers"
      @changed="tracked.refresh()"
      @forget="forget"
    />
  </div>
</template>

<style scoped>
.lookup-field {
  flex: 1 1 22rem;
}

.name-cell {
  max-inline-size: 18rem;
}
</style>
