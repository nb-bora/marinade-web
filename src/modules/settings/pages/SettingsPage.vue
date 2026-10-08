<script setup lang="ts">
import EstablishmentForm from '../components/EstablishmentForm.vue'
import OpeningHoursForm from '../components/OpeningHoursForm.vue'
import PaymentConfigForm from '../components/PaymentConfigForm.vue'
import ServiceTaxForm from '../components/ServiceTaxForm.vue'
import { settingsApi } from '../api'
import type { Restaurant } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const TABS = ['establishment', 'hours', 'service', 'payments'] as const

type Tab = typeof TABS[number]

// L'onglet vit dans l'URL : « /parametres?tab=hours » s'ouvre directement sur les horaires.
const tab = computed<Tab>({
  get: () => TABS.find(item => item === route.query.tab) ?? 'establishment',
  set: value => router.replace({ query: { ...route.query, tab: value === 'establishment' ? undefined : value } }),
})

const { data: restaurant, loading, error, reload } = useAsyncData<Restaurant | null>(
  async signal => tenant.currentId ? settingsApi.restaurant(tenant.currentId, signal) : null,
  { watch: [() => tenant.currentId] },
)

/** Le serveur ne laisse modifier un restaurant qu'à son propriétaire ou à un administrateur de la plateforme. */
const canEdit = computed(() =>
  tenant.can('management')
  && restaurant.value !== null
  && (restaurant.value.user_id === session.user?.id || session.isPlatformAdmin),
)

function onSaved(updated: Restaurant) {
  restaurant.value = updated
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Paramètres du restaurant"
      subtitle="Identité, horaires, service et paiements de votre établissement."
    />

    <AppErrorState
      v-if="error && !restaurant"
      :error="error"
      @retry="reload"
    />

    <VSkeletonLoader
      v-else-if="loading && !restaurant"
      type="card, card"
    />

    <template v-else-if="restaurant">
      <VAlert
        v-if="!canEdit && tab !== 'payments'"
        type="info"
        variant="tonal"
        class="mb-6"
      >
        Seul le propriétaire du restaurant peut modifier ces paramètres. Vous pouvez les consulter.
      </VAlert>

      <VTabs
        v-model="tab"
        class="mb-6"
      >
        <VTab
          value="establishment"
          prepend-icon="ri-store-2-line"
        >
          Établissement
        </VTab>
        <VTab
          value="hours"
          prepend-icon="ri-time-line"
        >
          Horaires
        </VTab>
        <VTab
          value="service"
          prepend-icon="ri-percent-line"
        >
          Service et taxes
        </VTab>
        <VTab
          value="payments"
          prepend-icon="ri-smartphone-line"
        >
          Paiements
        </VTab>
      </VTabs>

      <VWindow
        v-model="tab"
        :touch="false"
      >
        <VWindowItem value="establishment">
          <EstablishmentForm
            :restaurant="restaurant"
            :can-edit="canEdit"
            @saved="onSaved"
          />
        </VWindowItem>
        <VWindowItem value="hours">
          <OpeningHoursForm
            :restaurant="restaurant"
            :can-edit="canEdit"
            @saved="onSaved"
          />
        </VWindowItem>
        <VWindowItem value="service">
          <ServiceTaxForm
            :restaurant="restaurant"
            :can-edit="canEdit"
            @saved="onSaved"
          />
        </VWindowItem>
        <VWindowItem value="payments">
          <PaymentConfigForm
            :restaurant="restaurant"
            :can-edit="tenant.can('management')"
          />
        </VWindowItem>
      </VWindow>
    </template>
  </div>
</template>
