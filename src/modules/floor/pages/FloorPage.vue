<script setup lang="ts">
import { floorApi } from '../api'
import OpenSessionDialog from '../components/OpenSessionDialog.vue'
import TableTile from '../components/TableTile.vue'
import { useFloorData } from '../composables/useFloorData'
import { plural } from '../labels'
import { LOCATION_FALLBACK, locationOf, release, serviceOf, tableState } from '../service'
import type { ServiceSession, Table, TableView } from '../types'
import { useConfirm } from '@/composables/useConfirm'
import { useLive } from '@/composables/useLive'
import { formatMoney, formatRelative } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'
import type { StatStripItem } from '@/ui/AppStatStrip.vue'

const router = useRouter()
const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()

const { data, loading, error, reload, refresh } = useFloorData(true)

const now = ref(new Date())

watch(data, () => {
  now.value = new Date()
})

const { isLive } = useLive(refresh)

const ALL = '__all__'
const location = ref<string>(ALL)

const views = computed(() => data.value?.views ?? [])
const loose = computed(() => data.value?.looseSessions ?? [])

const locations = computed(() => [...new Set(views.value.map(view => locationOf(view.table)))])

// Un emplacement qui disparaît (table supprimée ou renommée) ne doit pas laisser un plan vide.
watch(locations, list => {
  if (location.value !== ALL && !list.includes(location.value))
    location.value = ALL
})

const locationOptions = computed(() => [
  { value: ALL, title: 'Toutes les zones' },
  ...locations.value.map(value => ({ value, title: value })),
])

const sections = computed(() => {
  const groups = new Map<string, TableView[]>()

  for (const view of views.value) {
    const key = locationOf(view.table)

    if (location.value === ALL || location.value === key)
      groups.set(key, [...(groups.get(key) ?? []), view])
  }

  return [...groups.entries()].map(([title, items]) => ({ title, items }))
})

const stats = computed<StatStripItem[]>(() => {
  const free = views.value.filter(view => tableState(view) === 'libre').length
  const occupied = views.value.filter(view => view.session).length
  const covers = views.value.reduce((sum, view) => sum + (view.session ? view.covers ?? 0 : 0), 0)

  const due = [...views.value, ...loose.value.map(item => ({ amountDue: item.amountDue }))]
    .reduce((sum, item) => sum + (item.amountDue ?? 0), 0)

  return [
    { label: 'Tables libres', value: `${free} / ${views.value.length}`, icon: 'ri-checkbox-circle-line' },
    { label: 'Tables occupées', value: String(occupied), icon: 'ri-restaurant-2-line' },
    { label: 'Couverts en salle', value: String(covers), icon: 'ri-group-line' },
    { label: 'Addition en cours', value: formatMoney(due), icon: 'ri-money-dollar-circle-line', hint: 'Reste à encaisser' },
  ]
})

// Ouverture d'une session ---------------------------------------------------------------

const opening = ref<Table | null>(null)
const openingDialog = ref(false)

function openSession(table: Table) {
  opening.value = table
  openingDialog.value = true
}

function goToSession(session: ServiceSession) {
  router.push(`/salle/sessions/${session.id}`)
}

async function setStatus(table: Table, message: string) {
  try {
    await floorApi.updateTable(table.id, release(table))
    toast.success(message)
    await refresh()
  }
  catch (cause) {
    toast.error(cause)
  }
}

async function select(view: TableView) {
  const state = tableState(view)

  if (view.session)
    return goToSession(view.session)

  if (state === 'settled') {
    const sessionId = serviceOf(view.table).session_id

    // La session soldée n'est plus listée par le serveur : on la retrouve par la table.
    if (sessionId)
      return router.push(`/salle/sessions/${sessionId}`)

    if (await confirm({ title: `Libérer la table ${view.table.numero} ?`, text: 'Aucune session ne l\'occupe plus : elle redeviendra disponible.', confirmLabel: 'Libérer' }))
      await setStatus(view.table, `Table ${view.table.numero} libérée.`)

    return
  }

  if (state === 'maintenance') {
    if (await confirm({ title: `Remettre la table ${view.table.numero} en service ?`, confirmLabel: 'Remettre en service' }))
      await setStatus(view.table, `Table ${view.table.numero} remise en service.`)

    return
  }

  openSession(view.table)
}

const hasTables = computed(() => views.value.length > 0 || loose.value.length > 0)
</script>

<template>
  <div>
    <AppPageHeader
      title="Plan de salle"
      subtitle="Touchez une table pour ouvrir une session ou reprendre une commande."
    >
      <template #actions>
        <VChip
          :color="isLive ? 'success' : 'secondary'"
          variant="tonal"
          size="small"
          label
        >
          <span
            class="live-dot me-2"
            :class="{ 'live-dot--on': isLive }"
          />
          {{ isLive ? 'En direct' : 'En pause' }}
        </VChip>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="loading"
          @click="reload"
        >
          Actualiser
        </VBtn>
        <VBtn
          v-if="tenant.can('management')"
          variant="outlined"
          to="/salle/tables"
          prepend-icon="ri-layout-grid-line"
        >
          Gérer les tables
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="error && !data"
      :error="error"
      @retry="reload"
    />

    <template v-else>
      <AppStatStrip
        :items="stats"
        :loading="loading && !data"
      />

      <div
        v-if="locations.length > 1"
        class="zones mt-6"
      >
        <AppSegmented
          v-model="location"
          :options="locationOptions"
          label="Zone de la salle"
        />
      </div>

      <VSkeletonLoader
        v-if="!data"
        type="card, card"
        class="mt-6"
      />

      <VCard
        v-else-if="!hasTables"
        class="mt-6"
      >
        <AppEmptyState
          icon="ri-layout-grid-line"
          title="Aucune table pour l'instant"
          text="Ajoutez les tables de votre salle pour pouvoir y ouvrir des sessions."
        >
          <VBtn
            v-if="tenant.can('management')"
            color="primary"
            to="/salle/tables"
            prepend-icon="ri-add-line"
          >
            Ajouter une table
          </VBtn>
        </AppEmptyState>
      </VCard>

      <template v-else>
        <section
          v-for="section in sections"
          :key="section.title"
          class="mt-6"
        >
          <h2 class="text-h6 mb-3 d-flex align-center gap-2">
            {{ section.title === LOCATION_FALLBACK && locations.length === 1 ? 'Tables' : section.title }}
            <span class="text-body-2 text-medium-emphasis font-weight-regular">{{ plural(section.items.length, 'table') }}</span>
          </h2>
          <div class="tiles">
            <TableTile
              v-for="view in section.items"
              :key="view.table.id"
              :view="view"
              :now="now"
              @select="select(view)"
            />
          </div>
        </section>

        <section
          v-if="loose.length && location === ALL"
          class="mt-6"
        >
          <h2 class="text-h6 mb-3">
            Sessions sans table
          </h2>
          <div class="tiles">
            <VCard
              v-for="item in loose"
              :key="item.session.id"
              variant="outlined"
              class="pa-4 cursor-pointer"
              tabindex="0"
              @click="goToSession(item.session)"
              @keydown.enter="goToSession(item.session)"
            >
              <div class="text-h6">
                {{ item.session.table_context || 'Session' }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ formatRelative(item.session.opened_at, now) }}
              </div>
              <div class="text-h6 mt-2">
                <AppMoney :amount="item.total" />
              </div>
            </VCard>
          </div>
        </section>
      </template>
    </template>

    <OpenSessionDialog
      v-model="openingDialog"
      :table="opening"
      @opened="goToSession"
    />
  </div>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
  gap: 14px;
}

.zones {
  max-inline-size: 100%;
  overflow-x: auto;
}

.live-dot {
  display: inline-block;
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: currentcolor;
}

.live-dot--on {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-dot--on {
    animation: none;
  }
}
</style>
