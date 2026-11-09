<script setup lang="ts">
import { useEventListener, useStorage } from '@vueuse/core'
import { useTheme } from 'vuetify'
import { floorApi } from '../api'
import CoversDialog from '../components/CoversDialog.vue'
import FloorDesigner from '../components/FloorDesigner.vue'
import FloorPlan from '../components/FloorPlan.vue'
import FloorStats from '../components/FloorStats.vue'
import FloorWatchlist from '../components/FloorWatchlist.vue'
import OpenSessionDialog from '../components/OpenSessionDialog.vue'
import TableDetailPanel from '../components/TableDetailPanel.vue'
import TableFormDialog from '../components/TableFormDialog.vue'
import { useFloorData } from '../composables/useFloorData'
import { useFloorDesigner } from '../composables/useFloorDesigner'
import { STALE_MINUTES, compactMoney, floorStats, formatElapsed, minutesSince, watchlist } from '../composables/useFloorMetrics'
import { planStateOf } from '../composables/useFloorPlan'
import { buildScene3D } from '../three/scene3d'
import { playChime } from '../composables/useFloorSound'
import { levelIdOf, placementOf, viewsOfLevel, withPlacement } from '../layout'
import { PLAN_STATE } from '../labels'
import { locationOf, release } from '../service'
import type { ServiceSession, Table, TableView } from '../types'
import { useConfirm } from '@/composables/useConfirm'
import { useLive } from '@/composables/useLive'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const router = useRouter()
const theme = useTheme()

// La vue 3D (three.js) ne se charge que si on la demande.
const Floor3DView = defineAsyncComponent(() => import('../components/Floor3DView.vue'))
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
const salle = computed(() => data.value?.salle ?? { version: 1 as const, niveaux: [{ id: 'rdc', nom: 'Rez-de-chaussée' }], zones: [] })

// Niveaux (étages) : le plan montre un niveau à la fois ; le dernier choisi est retenu sur cet appareil.
const storedLevel = useStorage('marinade.floor.level', '')

const levelId = computed({
  get: () => salle.value.niveaux.some(level => level.id === storedLevel.value) ? storedLevel.value : salle.value.niveaux[0].id,
  set: value => {
    storedLevel.value = value
  },
})

const levelOptions = computed(() => salle.value.niveaux.map(level => ({
  value: level.id,
  title: level.nom,
})))

/** Les tables du niveau affiché : c'est ce que dessine le plan. */
const levelViews = computed(() => viewsOfLevel(views.value, salle.value, levelId.value))

const locations = computed(() => [...new Set(levelViews.value.map(view => locationOf(view.table)))])

/** Toutes les zones du restaurant (déclarées ou utilisées), proposées dans le formulaire d'une table. */
const allZones = computed(() => [...new Set([...salle.value.zones.map(zone => zone.nom), ...views.value.map(view => locationOf(view.table))])])

watch(levelId, () => {
  location.value = ALL
})

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

const stats = computed(() => floorStats(views.value, loose.value, now.value))
const canManage = computed(() => tenant.can('management'))
const watched = computed(() => watchlist(views.value, now.value))

/** Sessions sans table : les récentes en cartes, celles ouvertes depuis plus de 12 h à part (oubliées ?). */
const looseRecent = computed(() => loose.value.filter(item => minutesSince(item.session.opened_at, now.value) < STALE_MINUTES))
const looseStale = computed(() => loose.value.filter(item => minutesSince(item.session.opened_at, now.value) >= STALE_MINUTES))
const showStale = ref(false)

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

// Vue 2D / 3D -----------------------------------------------------------------------------------

const designing = ref(false)

type ViewKey = '2d' | '3d-level' | '3d-building'

const storedView = useStorage<ViewKey>('marinade.floor.view', '2d')

const viewMode = computed<ViewKey>({
  get: () => ['2d', '3d-level', '3d-building'].includes(storedView.value) ? storedView.value : '2d',
  set: value => {
    storedView.value = value
  },
})

const is3d = computed(() => viewMode.value !== '2d' && !designing.value)
const scene = computed(() => is3d.value ? buildScene3D(views.value, salle.value) : [])
const dark = computed(() => theme.current.value.dark)

const VIEW_OPTIONS = [
  { value: '2d' as ViewKey, title: 'Plan 2D' },
  { value: '3d-level' as ViewKey, title: '3D du niveau' },
  { value: '3d-building' as ViewKey, title: 'Bâtiment 3D' },
]

function select3d(id: string) {
  const view = views.value.find(item => item.table.id === id)

  if (view)
    select(view)
}

// Aménagement ---------------------------------------------------------------------------------

const designer = useFloorDesigner(() => data.value, () => refresh())

const editedTable = ref<Table | null>(null)
const coversDialog = ref(false)
const tableDialog = ref(false)

function editTable(view: TableView) {
  editedTable.value = view.table
  tableDialog.value = true
}

/** Déplacement d'une table sur le plan : affiché tout de suite, puis enregistré côté serveur. */
function onMove(point: { id: string; x: number; y: number }) {
  const view = views.value.find(item => item.table.id === point.id)

  if (!view)
    return

  const placed = placementOf(view.table)
  const update = withPlacement(view.table, { niveau: levelId.value, x: point.x, y: point.y, forme: placed?.forme, rot: placed?.rot })

  view.table = { ...view.table, attributs_jsonb: update.attributs_jsonb as typeof view.table.attributs_jsonb }
  designer.placeTable(view.table, { niveau: levelId.value, x: point.x, y: point.y })
}

watch(designing, on => {
  if (!on)
    selectedId.value = null
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

  // Une table d'un autre niveau (liste « À surveiller ») : on affiche son niveau.
  levelId.value = levelIdOf(view.table, salle.value)

  if (!designing.value && planStateOf(view) === 'free')
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

// Liens depuis la liste des tables : `?table=<id>` ouvre la fiche de la table, `?amenager=1` l'aménagement.
const route = useRoute()
let routed = false

watch(data, snapshot => {
  if (routed || !snapshot)
    return

  routed = true

  const id = typeof route.query.table === 'string' ? route.query.table : null
  const view = id ? snapshot.views.find(item => item.table.id === id) : null

  if (view) {
    levelId.value = levelIdOf(view.table, snapshot.salle)
    selectedId.value = view.table.id
  }

  if (route.query.amenager === '1' && canManage.value)
    designing.value = true

  if (view || route.query.amenager)
    router.replace({ path: route.path })
}, { immediate: true })
</script>

<template>
  <div class="floor-page">
    <AppHero
      eyebrow="Plan de salle"
      title="Votre salle en direct"
      subtitle="Touchez une table pour ouvrir une session ou reprendre une commande."
      :live="isLive"
    >
      <template #eyebrow-extra>
        · {{ isLive ? 'actualisé en continu' : 'en pause' }}
      </template>
      <template #actions>
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
          v-if="canManage"
          variant="text"
          prepend-icon="ri-table-line"
          to="/salle/tables"
        >
          Liste des tables
        </VBtn>
        <VBtn
          v-if="canManage"
          :prepend-icon="designing ? 'ri-check-line' : 'ri-pencil-ruler-2-line'"
          :color="designing ? 'success' : 'primary'"
          :aria-pressed="designing"
          data-tour="floor-design-btn"
          @click="designing = !designing"
        >
          {{ designing ? 'Terminer' : 'Aménager' }}
        </VBtn>
      </template>
    </AppHero>

    <AppErrorState
      v-if="error && !data"
      :error="error"
      @retry="reload"
    />

    <template v-else>
      <FloorStats
        class="mt-5"
        :stats="stats"
        :loading="loading && !data"
      />

      <div
        v-if="salle.niveaux.length > 1"
        class="zones mt-5"
        data-tour="floor-levels"
      >
        <AppSegmented
          v-model="levelId"
          :options="levelOptions"
          label="Niveau du restaurant"
        />
      </div>

      <div
        v-if="data && hasTables"
        class="view-switch mt-3"
        data-tour="floor-views"
      >
        <AppSegmented
          v-model="viewMode"
          :options="VIEW_OPTIONS"
          label="Affichage de la salle"
        />
        <span
          v-if="designing"
          class="text-caption text-medium-emphasis"
        >L'aménagement se fait sur le plan 2D.</span>
      </div>

      <div
        v-if="locations.length > 1 && !is3d"
        class="zones mt-3"
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
        class="mt-5"
      />

      <VCard
        v-else-if="!hasTables && !designing"
        class="mt-6"
      >
        <AppEmptyState
          icon="ri-layout-grid-line"
          title="Aucune table pour l'instant"
          text="Dessinez votre salle : ajoutez vos tables, vos terrasses et vos étages, puis placez-les sur le plan."
        >
          <VBtn
            v-if="canManage"
            color="primary"
            prepend-icon="ri-pencil-ruler-2-line"
            @click="designing = true"
          >
            Aménager la salle
          </VBtn>
        </AppEmptyState>
      </VCard>

      <template v-else>
        <div class="floor-layout mt-5">
          <template v-if="!is3d">
            <FloorPlan
              v-if="levelViews.length"
              :views="levelViews"
              :now="now"
              :selected-id="selectedId"
              :zone="planZone"
              :flashes="flashes"
              :editable="designing"
              @select="select"
              @move="onMove"
            />
            <VCard v-else>
              <AppEmptyState
                icon="ri-layout-grid-line"
                title="Ce niveau est vide"
                :text="designing ? 'Ajoutez des tables avec le panneau d\'aménagement.' : 'Aucune table n\'est placée à ce niveau.'"
              />
            </VCard>
          </template>
          <VCard
            v-else
            class="floor3d"
            data-tour="floor-3d"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="primary"
                  variant="tonal"
                  rounded="lg"
                >
                  <VIcon :icon="viewMode === '3d-building' ? 'ri-building-4-line' : 'ri-box-3-line'" />
                </VAvatar>
              </template>
              <VCardTitle>{{ viewMode === '3d-building' ? 'Le bâtiment en 3D' : 'Le niveau en 3D' }}</VCardTitle>
              <VCardSubtitle class="text-wrap">
                {{ viewMode === '3d-building' ? 'Tous les niveaux empilés : touchez une table, tournez la vue avec la souris ou le doigt.' : 'Faites tourner la salle, zoomez, touchez une table. Les chaises grises sont libres.' }}
              </VCardSubtitle>
            </VCardItem>
            <div class="floor3d__stage">
              <Floor3DView
                :levels="scene"
                :mode="viewMode === '3d-building' ? 'building' : 'level'"
                :level-id="levelId"
                :selected-id="selectedId"
                :dark="dark"
                @select="select3d"
              />
            </div>
          </VCard>

          <aside
            ref="panel"
            class="floor-layout__aside"
            :class="{ 'floor-layout__aside--empty': !selected && !designing }"
            aria-label="Détail de la table"
          >
            <FloorDesigner
              v-if="designing && data"
              :snapshot="data"
              :level-id="levelId"
              :selected="selected"
              :designer="designer"
              @select-level="levelId = $event"
              @edit-table="editTable"
              @done="designing = false"
            />
            <TableDetailPanel
              v-else-if="selected"
              :view="selected"
              :state="planStateOf(selected)"
              :now="now"
              :level-name="salle.niveaux.length > 1 ? salle.niveaux.find(item => item.id === levelIdOf(selected!.table, salle))?.nom : undefined"
              @close="closePanel"
              @open-session="openSession(selected.table)"
              @release="releaseTable(selected)"
              @edit-covers="coversDialog = true"
            />
            <FloorWatchlist
              v-else
              :items="watched"
              @select="select"
            />
          </aside>
        </div>

        <section
          v-if="loose.length && location === ALL"
          class="mt-8"
          aria-labelledby="loose-title"
        >
          <h2
            id="loose-title"
            class="section-title"
          >
            <span class="section-title__bar" />Sessions sans table
            <VChip
              size="x-small"
              variant="tonal"
              label
            >
              {{ loose.length }}
            </VChip>
          </h2>

          <div
            v-if="looseRecent.length"
            class="loose"
          >
            <button
              v-for="item in looseRecent"
              :key="item.session.id"
              type="button"
              class="loose-card"
              @click="goToSession(item.session)"
            >
              <span class="loose-card__top">
                <VIcon
                  icon="ri-store-3-line"
                  size="18"
                  class="text-medium-emphasis"
                />
                <span class="loose-card__name">{{ item.session.table_context || 'Session' }}</span>
              </span>
              <span class="loose-card__meta">ouverte depuis {{ formatElapsed(minutesSince(item.session.opened_at, now)) }}</span>
              <span class="loose-card__amount tabular-nums">{{ item.total === null ? '—' : compactMoney(item.total) }}<small v-if="item.total !== null"> FCFA</small></span>
            </button>
          </div>

          <VAlert
            v-if="looseStale.length"
            type="warning"
            variant="tonal"
            density="comfortable"
            class="mt-3"
            icon="ri-history-line"
          >
            <div class="d-flex flex-wrap align-center gap-3">
              <span>
                <strong>{{ looseStale.length }} session{{ looseStale.length > 1 ? 's' : '' }}</strong>
                ouverte{{ looseStale.length > 1 ? 's' : '' }} depuis plus de 12 h : vérifiez si elle{{ looseStale.length > 1 ? 's sont' : ' est' }} encore utile{{ looseStale.length > 1 ? 's' : '' }}.
              </span>
              <VSpacer />
              <VBtn
                size="small"
                variant="text"
                :append-icon="showStale ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"
                @click="showStale = !showStale"
              >
                {{ showStale ? 'Masquer' : 'Afficher' }}
              </VBtn>
            </div>
            <div
              v-if="showStale"
              class="loose mt-3"
            >
              <button
                v-for="item in looseStale"
                :key="item.session.id"
                type="button"
                class="loose-card loose-card--stale"
                @click="goToSession(item.session)"
              >
                <span class="loose-card__top">
                  <VIcon
                    icon="ri-history-line"
                    size="18"
                  />
                  <span class="loose-card__name">{{ item.session.table_context || 'Session' }}</span>
                </span>
                <span class="loose-card__meta">ouverte depuis {{ formatElapsed(minutesSince(item.session.opened_at, now)) }}</span>
                <span class="loose-card__amount tabular-nums">{{ item.total === null ? '—' : compactMoney(item.total) }}<small v-if="item.total !== null"> FCFA</small></span>
              </button>
            </div>
          </VAlert>
        </section>
      </template>
    </template>

    <CoversDialog
      v-model="coversDialog"
      :session="selected?.session ?? null"
      :table="selected?.table ?? null"
      :covers="selected?.covers ?? null"
      @saved="refresh"
    />

    <TableFormDialog
      v-model="tableDialog"
      :table="editedTable"
      :locations="allZones"
      :salle="salle"
      :designer="designer"
      :default-level="levelId"
      can-edit-layout
      @saved="refresh"
    />

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

<style scoped lang="scss">
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

.view-switch {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.floor3d__stage {
  block-size: clamp(420px, 62vh, 660px);
  border-radius: 14px;
  margin: 0 16px 16px;
  overflow: hidden;
}

.loose {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 12px;
}

.loose-card {
  align-items: flex-start;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 14px;
  color: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font: inherit;
  gap: 0.2rem;
  padding: 0.85rem 1rem;
  text-align: start;
  transition: border-color 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: rgba(var(--v-theme-primary), 0.5);
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }

  &--stale {
    opacity: 0.85;
  }
}

.loose-card__top {
  align-items: center;
  display: flex;
  gap: 0.4rem;
}

.loose-card__name {
  font-weight: 600;
}

.loose-card__meta {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8rem;
}

.loose-card__amount {
  font-size: 1.15rem;
  font-weight: 700;
  margin-top: 0.25rem;

  small {
    font-size: 0.65em;
    font-weight: 500;
    opacity: 0.7;
  }
}

.section-title {
  align-items: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  display: flex;
  font-size: 0.78rem;
  font-weight: 700;
  gap: 0.6rem;
  letter-spacing: 0.12em;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
}

.section-title__bar {
  background: rgb(var(--v-theme-primary));
  border-radius: 2px;
  height: 14px;
  transform: skewX(-18deg);
  width: 5px;
}

/* Cartes de la page : coins larges et filet fin, comme le tableau de bord. */
.floor-page :deep(.v-card:not(.tile)) {
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
}

.floor-page :deep(.v-card-title) {
  font-size: 1.02rem;
  font-weight: 650;
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
</style>
