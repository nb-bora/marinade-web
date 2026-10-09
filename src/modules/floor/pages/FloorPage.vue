<script setup lang="ts">
import { useEventListener, useStorage } from '@vueuse/core'
import { floorApi } from '../api'
import FloorPlan from '../components/FloorPlan.vue'
import OpenSessionDialog from '../components/OpenSessionDialog.vue'
import TableDetailPanel from '../components/TableDetailPanel.vue'
import { useFloorData } from '../composables/useFloorData'
import { planStateOf } from '../composables/useFloorPlan'
import { playChime } from '../composables/useFloorSound'
import { PLAN_STATE } from '../labels'
import { locationOf, release } from '../service'
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

// Le plan se recharge toutes les 5 s (au lieu des 10 s par défaut) : une table prise
// ou libérée doit se voir presque tout de suite.
const { isLive } = useLive(refresh, 5000)

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

const planZone = computed(() => location.value === ALL ? null : location.value)

const stats = computed<StatStripItem[]>(() => {
  const free = views.value.filter(view => planStateOf(view) === 'free').length
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

// Sélection --------------------------------------------------------------------------------

const selectedId = ref<string | null>(null)
const panel = ref<HTMLElement | null>(null)

const selected = computed(() => views.value.find(view => view.table.id === selectedId.value) ?? null)

// Une table supprimée pendant qu'on la regarde ne doit pas laisser un panneau vide.
watch(selected, view => {
  if (!view)
    selectedId.value = null
})

watch(selectedId, async id => {
  if (!id)
    return

  await nextTick()

  // Sur téléphone, le détail est sous le plan : on y amène l'écran.
  if (window.innerWidth < 1280)
    panel.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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

/** Libérer une table soldée, ou remettre en service une table hors service. */
async function releaseTable(view: TableView) {
  const { numero } = view.table
  const maintenance = planStateOf(view) === 'maintenance'

  const confirmed = await confirm(maintenance
    ? { title: `Remettre la table ${numero} en service ?`, confirmLabel: 'Remettre en service' }
    : { title: `Libérer la table ${numero} ?`, text: 'Aucune session ne l\'occupe plus : elle redeviendra disponible.', confirmLabel: 'Libérer' })

  if (confirmed)
    await setStatus(view.table, maintenance ? `Table ${numero} remise en service.` : `Table ${numero} libérée.`)
}

/** Clic sur une table du plan : une table libre ouvre tout de suite le dialogue, les autres montrent leur détail. */
function select(view: TableView) {
  selectedId.value = view.table.id

  if (planStateOf(view) === 'free')
    openSession(view.table)
}

function closePanel() {
  selectedId.value = null
}

useEventListener(window, 'keydown', event => {
  if (event.key === 'Escape' && selectedId.value && !openingDialog.value && !document.querySelector('.v-overlay--active'))
    closePanel()
})

// Temps réel ---------------------------------------------------------------------------------

const sound = useStorage('marinade.floor.sound', false)

/** Tables dont l'état vient de changer : une onde de 1,3 s, puis plus rien. */
const flashes = ref<Record<string, 'in' | 'out'>>({})
const announcement = ref('')

const timers = new Map<string, ReturnType<typeof setTimeout>>()
let previous: Map<string, string> | null = null

const ENGAGED = new Set(['busy', 'paying'])

function flash(id: string, kind: 'in' | 'out') {
  clearTimeout(timers.get(id))
  flashes.value = { ...flashes.value, [id]: kind }

  timers.set(id, setTimeout(() => {
    const rest = { ...flashes.value }

    delete rest[id]
    flashes.value = rest
    timers.delete(id)
  }, 1300))
}

watch(views, list => {
  const current = new Map(list.map(view => [view.table.id, planStateOf(view)]))

  // Premier chargement (ou changement de restaurant) : rien ne « vient » de changer.
  if (previous) {
    let chime: 'in' | 'out' | null = null

    for (const view of list) {
      const before = previous.get(view.table.id)
      const after = current.get(view.table.id)!

      if (!before || before === after)
        continue

      const kind = ENGAGED.has(after) ? 'in' : ENGAGED.has(before) ? 'out' : null

      if (!kind)
        continue

      flash(view.table.id, kind)
      chime = kind === 'in' ? 'in' : chime ?? 'out'
      announcement.value = `Table ${view.table.numero} : ${PLAN_STATE[after as keyof typeof PLAN_STATE].label.toLowerCase()}.`
    }

    if (chime && sound.value)
      playChime(chime)
  }

  previous = current
})

watch(() => tenant.currentId, () => {
  previous = null
  selectedId.value = null
})

onBeforeUnmount(() => timers.forEach(timer => clearTimeout(timer)))

function toggleSound() {
  sound.value = !sound.value

  // Le navigateur n'autorise le son qu'après un geste : on le prépare et on le fait entendre.
  if (sound.value)
    playChime('in')
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
          :icon="sound ? 'ri-volume-up-line' : 'ri-volume-mute-line'"
          :variant="sound ? 'tonal' : 'text'"
          :color="sound ? 'primary' : undefined"
          :aria-label="sound ? 'Couper le son des nouvelles tables' : 'Activer le son des nouvelles tables'"
          :aria-pressed="sound"
          @click="toggleSound"
        >
          <VIcon :icon="sound ? 'ri-volume-up-line' : 'ri-volume-mute-line'" />
          <VTooltip
            activator="parent"
            location="bottom"
          >
            {{ sound ? 'Son activé : un signal à chaque changement' : 'Activer un signal sonore' }}
          </VTooltip>
        </VBtn>
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
        <div class="floor-layout mt-6">
          <FloorPlan
            v-if="views.length"
            :views="views"
            :now="now"
            :selected-id="selectedId"
            :zone="planZone"
            :flashes="flashes"
            @select="select"
          />

          <aside
            ref="panel"
            class="floor-layout__aside"
            :class="{ 'floor-layout__aside--empty': !selected }"
            aria-label="Détail de la table"
          >
            <TableDetailPanel
              v-if="selected"
              :view="selected"
              :state="planStateOf(selected)"
              :now="now"
              @close="closePanel"
              @open-session="openSession(selected.table)"
              @release="releaseTable(selected)"
            />
            <VCard
              v-else
              variant="outlined"
            >
              <AppEmptyState
                icon="ri-cursor-line"
                title="Choisissez une table"
                text="Son état, ses couverts et son montant s'affichent ici."
              />
            </VCard>
          </aside>
        </div>

        <section
          v-if="loose.length && location === ALL"
          class="mt-6"
        >
          <h2 class="text-h6 mb-3">
            Sessions sans table
          </h2>
          <div class="loose">
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

    <div
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ announcement }}
    </div>
  </div>
</template>

<style scoped>
.floor-layout {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr);
}

.floor-layout__aside--empty {
  display: none;
}

/* À partir de 1280 px, le détail passe à droite du plan et le suit au défilement. */
@media (min-width: 1280px) {
  .floor-layout {
    align-items: start;
    grid-template-columns: minmax(0, 1fr) 340px;
  }

  .floor-layout__aside,
  .floor-layout__aside--empty {
    position: sticky;
    display: block;
    inset-block-start: 88px;
  }
}

.loose {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
  gap: 14px;
}

.zones {
  max-inline-size: 100%;
  overflow-x: auto;
}

.sr-only {
  position: absolute;
  overflow: hidden;
  clip: rect(0 0 0 0);
  block-size: 1px;
  inline-size: 1px;
  white-space: nowrap;
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
