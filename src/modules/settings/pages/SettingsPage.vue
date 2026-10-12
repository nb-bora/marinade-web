<script setup lang="ts">
import EstablishmentForm from '../components/EstablishmentForm.vue'
import OpeningHoursForm from '../components/OpeningHoursForm.vue'
import PaymentConfigForm from '../components/PaymentConfigForm.vue'
import ServiceTaxForm from '../components/ServiceTaxForm.vue'
import '../settings.css'
import { settingsApi } from '../api'
import { sinceLabel } from '../labels'
import type { Restaurant, SettingsPanel } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const confirm = useConfirm()

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

// Onglets : chacun expose son état pour l'en-tête (bouton Enregistrer, pastilles « modifié »).
const establishment = ref<SettingsPanel | null>(null)
const hours = ref<SettingsPanel | null>(null)
const service = ref<SettingsPanel | null>(null)
const payments = ref<SettingsPanel | null>(null)

const panels = computed<Record<Tab, SettingsPanel | null>>(() => ({
  establishment: establishment.value,
  hours: hours.value,
  service: service.value,
  payments: payments.value,
}))

const active = computed(() => panels.value[tab.value])
const isDirty = (key: Tab) => panels.value[key]?.dirty === true
const anyDirty = computed(() => TABS.some(isDirty))

const showSave = computed(() => canEdit.value && tab.value !== 'payments')

// Indicateur d'enregistrement.
const savedAt = ref<number | null>(null)
const now = ref(Date.now())

useIntervalFn(() => {
  now.value = Date.now()
}, 15_000)

function onSaved(updated: Restaurant) {
  restaurant.value = updated
  savedAt.value = Date.now()
  now.value = savedAt.value
}

const status = computed<{ tone: 'info' | 'warning' | 'success'; icon: string; text: string; spin: boolean } | null>(() => {
  if (active.value?.pending)
    return { tone: 'info', icon: 'ri-loader-4-line', text: 'Enregistrement…', spin: true }

  if (anyDirty.value)
    return { tone: 'warning', icon: 'ri-edit-circle-line', text: 'Modifications non enregistrées', spin: false }

  if (savedAt.value)
    return { tone: 'success', icon: 'ri-checkbox-circle-line', text: `Enregistré ${sinceLabel(savedAt.value, now.value)}`, spin: false }

  return null
})

const TAB_LABELS: Record<Tab, string> = {
  establishment: 'Établissement',
  hours: 'Horaires',
  service: 'Service et taxes',
  payments: 'Paiements',
}

const dirtyTabs = computed(() => TABS.filter(isDirty).map(key => TAB_LABELS[key]))

function save() {
  return active.value?.submit()
}

// Ctrl/Cmd + S enregistre l'onglet affiché.
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && showSave.value) {
    event.preventDefault()
    if (active.value?.dirty && !active.value.invalid)
      save()
  }
})

// Garde-fous : fermer l'onglet du navigateur ou changer de page avec des modifications.
useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
  if (anyDirty.value)
    event.preventDefault()
})

onBeforeRouteLeave(async () => {
  if (!anyDirty.value)
    return true

  return confirm({
    title: 'Quitter sans enregistrer ?',
    text: `Modifications en attente : ${dirtyTabs.value.join(', ')}. Elles restent conservées comme brouillon sur cet appareil, mais ne sont pas appliquées au restaurant.`,
    confirmLabel: 'Quitter la page',
    cancelLabel: 'Rester',
  })
})
</script>

<template>
  <div class="settings-page">
    <AppPageHeader
      title="Paramètres"
      :subtitle="restaurant?.name ?? 'Identité, horaires, service et paiements de votre établissement.'"
    >
      <template
        v-if="restaurant"
        #actions
      >
        <VFadeTransition mode="out-in">
          <AppStatusChip
            v-if="status"
            :key="status.text"
            :label="status.text"
            :tone="status.tone"
            :icon="status.icon"
            role="status"
          />
        </VFadeTransition>
        <VBtn
          v-if="showSave"
          prepend-icon="ri-save-3-line"
          :loading="active?.pending"
          :disabled="!active?.dirty || active?.invalid"
          @click="save"
        >
          Enregistrer
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="error && !restaurant"
      :error="error"
      @retry="reload"
    />

    <div v-else-if="loading && !restaurant">
      <VSkeletonLoader
        type="heading"
        class="mb-6"
      />
      <VSkeletonLoader type="image, article" />
    </div>

    <template v-else-if="restaurant">
      <VAlert
        v-if="!canEdit"
        type="info"
        variant="tonal"
        class="mb-6"
        icon="ri-lock-line"
      >
        Seul le propriétaire du restaurant peut modifier ces paramètres. Vous pouvez les consulter.
      </VAlert>

      <VTabs
        v-model="tab"
        class="mb-6"
        show-arrows
      >
        <VTab
          value="establishment"
          prepend-icon="ri-building-line"
        >
          Établissement
          <span
            v-if="isDirty('establishment')"
            class="settings-tab-dot"
            role="img"
            aria-label="Modifications non enregistrées"
          />
        </VTab>
        <VTab
          value="hours"
          prepend-icon="ri-time-line"
        >
          Horaires
          <span
            v-if="isDirty('hours')"
            class="settings-tab-dot"
            role="img"
            aria-label="Modifications non enregistrées"
          />
        </VTab>
        <VTab
          value="service"
          prepend-icon="ri-money-dollar-circle-line"
        >
          Service et taxes
          <span
            v-if="isDirty('service')"
            class="settings-tab-dot"
            role="img"
            aria-label="Modifications non enregistrées"
          />
        </VTab>
        <VTab
          value="payments"
          prepend-icon="ri-lock-line"
        >
          Paiements
        </VTab>
      </VTabs>

      <VExpandTransition>
        <VAlert
          v-if="anyDirty && showSave"
          type="warning"
          variant="tonal"
          density="compact"
          class="settings-banner mb-6"
          icon="ri-edit-circle-line"
        >
          Modifications non enregistrées : {{ dirtyTabs.join(', ') }}.
        </VAlert>
      </VExpandTransition>

      <VWindow
        v-model="tab"
        class="settings-window"
        :touch="false"
      >
        <VWindowItem value="establishment">
          <EstablishmentForm
            ref="establishment"
            :restaurant="restaurant"
            :can-edit="canEdit"
            @saved="onSaved"
          />
        </VWindowItem>
        <VWindowItem value="hours">
          <OpeningHoursForm
            ref="hours"
            :restaurant="restaurant"
            :can-edit="canEdit"
            @saved="onSaved"
          />
        </VWindowItem>
        <VWindowItem value="service">
          <ServiceTaxForm
            ref="service"
            :restaurant="restaurant"
            :can-edit="canEdit"
            @saved="onSaved"
          />
        </VWindowItem>
        <VWindowItem value="payments">
          <PaymentConfigForm
            ref="payments"
            :restaurant="restaurant"
            :can-edit="tenant.can('management')"
          />
        </VWindowItem>
      </VWindow>
    </template>
  </div>
</template>
