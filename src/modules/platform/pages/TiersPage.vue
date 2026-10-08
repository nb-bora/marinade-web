<script setup lang="ts">
import { platformApi } from '../api'
import TierFormDialog from '../components/TierFormDialog.vue'
import type { Tier } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'

const { data, loading, error, reload, refresh } = useAsyncData(signal => platformApi.tiers(signal))

const tiers = computed(() => [...(data.value ?? [])].sort((a, b) => a.monthly_price_fcfa - b.monthly_price_fcfa))

const dialog = ref(false)
const edited = ref<Tier | null>(null)

function create() {
  edited.value = null
  dialog.value = true
}

function edit(tier: Tier) {
  edited.value = tier
  dialog.value = true
}

/** Économie d'un abonnement annuel par rapport à douze mois, en pourcentage entier. */
function savings(tier: Tier): number {
  const yearOfMonths = tier.monthly_price_fcfa * 12

  return yearOfMonths > 0 ? Math.max(0, Math.round((1 - tier.annual_price_fcfa / yearOfMonths) * 100)) : 0
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Offres"
      subtitle="Les formules d'abonnement proposées aux restaurants, avec leur plafond d'encaissement par jour."
    >
      <template #actions>
        <VBtn
          prepend-icon="ri-add-line"
          @click="create"
        >
          Nouvelle offre
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="error && data === null"
      :error="error"
      @retry="reload"
    />

    <VRow v-else-if="data === null && loading">
      <VCol
        v-for="n in 3"
        :key="n"
        cols="12"
        md="4"
      >
        <VSkeletonLoader type="card" />
      </VCol>
    </VRow>

    <VCard v-else-if="tiers.length === 0">
      <AppEmptyState
        icon="ri-price-tag-3-line"
        title="Aucune offre"
        text="Créez une première offre pour pouvoir abonner un restaurant."
      >
        <VBtn @click="create">
          Nouvelle offre
        </VBtn>
      </AppEmptyState>
    </VCard>

    <VRow v-else>
      <VCol
        v-for="tier in tiers"
        :key="tier.id"
        cols="12"
        sm="6"
        lg="4"
      >
        <VCard
          class="h-100 tier-card"
          :class="{ 'tier-card--off': !tier.is_active }"
        >
          <VCardText class="d-flex flex-column h-100 pa-6">
            <div class="d-flex align-center justify-space-between gap-3">
              <h2 class="text-h5 font-weight-semibold text-truncate">
                {{ tier.name }}
              </h2>
              <AppStatusChip
                :label="tier.is_active ? 'Active' : 'Désactivée'"
                :tone="tier.is_active ? 'success' : 'neutral'"
              />
            </div>

            <div class="mt-5">
              <span class="text-h3 font-weight-bold text-primary tabular-nums">
                <AppMoney :amount="tier.monthly_price_fcfa" />
              </span>
              <span class="text-body-1 text-medium-emphasis"> / mois</span>
            </div>
            <div class="text-body-2 text-medium-emphasis mt-1">
              ou <AppMoney :amount="tier.annual_price_fcfa" /> par an
              <VChip
                v-if="savings(tier) > 0"
                size="x-small"
                color="success"
                label
                class="ms-1"
              >
                -{{ savings(tier) }} %
              </VChip>
            </div>

            <VDivider class="my-5" />

            <div class="d-flex align-center gap-3">
              <VAvatar
                variant="tonal"
                color="primary"
                rounded
                size="40"
              >
                <VIcon icon="ri-speed-up-line" />
              </VAvatar>
              <div>
                <div class="text-body-2 text-medium-emphasis">
                  Plafond journalier
                </div>
                <div class="text-h6 font-weight-semibold">
                  <AppMoney :amount="tier.daily_limit_fcfa" />
                </div>
              </div>
            </div>

            <VSpacer />

            <VBtn
              class="mt-6"
              variant="tonal"
              block
              prepend-icon="ri-edit-line"
              @click="edit(tier)"
            >
              Modifier l'offre
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <TierFormDialog
      v-model="dialog"
      :tier="edited"
      @saved="refresh"
    />
  </div>
</template>

<style scoped>
.tier-card--off {
  opacity: 0.7;
}
</style>
