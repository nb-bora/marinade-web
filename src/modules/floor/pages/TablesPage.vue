<!--
  Les tables de la salle : indicateurs, filtres (recherche, zone, niveau, état) et liste triable. Mêmes
  états, mêmes couleurs et mêmes mots que le plan de salle ; sur téléphone la liste devient des cartes.
  Création et modification passent par les formulaires (qui confirment), la suppression par une
  confirmation (refusée tant qu'une session est ouverte sur la table).
-->
<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { useDisplay } from 'vuetify'
import FloorStatePills from '../components/FloorStatePills.vue'
import SeatRow from '../components/SeatRow.vue'
import TableFormDialog from '../components/TableFormDialog.vue'
import TablesBatchDialog from '../components/TablesBatchDialog.vue'
import { useFloorData } from '../composables/useFloorData'
import { useFloorDesigner } from '../composables/useFloorDesigner'
import { formatElapsed } from '../composables/useFloorMetrics'
import type { SortKey, TableRow } from '../composables/useTableRows'
import { DEFAULT_DIRECTION, buildRows, filterRows, sortRows, stateCounts, tableTotals } from '../composables/useTableRows'
import { tablesImport } from '../imports'
import type { PlanState } from '../labels'
import { PLAN_STATE, plural } from '../labels'
import { ZONE_TYPES, defaultSalle, seatsLabel } from '../layout'
import type { Table } from '../types'
import { useClientPagination } from '@/composables/useClientPagination'
import { useLive } from '@/composables/useLive'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const { smAndDown } = useDisplay()

const importDialog = ref(false)
const importDefinition = tablesImport()

const { data, loading, error, reload, refresh } = useFloorData(false)
const { isLive } = useLive(refresh)
const designer = useFloorDesigner(() => data.value, () => refresh())

const now = useNow({ interval: 30_000 })
const canManage = computed(() => tenant.can('management'))

const salle = computed(() => data.value?.salle ?? defaultSalle())
const rows = computed(() => buildRows(data.value?.views ?? [], salle.value, now.value))
const totals = computed(() => tableTotals(rows.value, salle.value))
const counts = computed(() => stateCounts(rows.value))

// Filtres ---------------------------------------------------------------------------------------

const ALL = '__all__'

const search = ref('')
const searchDebounced = refDebounced(search, 250)
const stateFilter = ref<PlanState | null>(null)
const zoneFilter = ref<string | null>(null)
const levelKey = ref<string>(ALL)

const filters = computed(() => ({
  query: searchDebounced.value,
  state: stateFilter.value,
  zone: zoneFilter.value,
  level: levelKey.value === ALL ? null : levelKey.value,
}))

const hasFilters = computed(() => filters.value.query.trim() !== '' || filters.value.state !== null || filters.value.zone !== null || filters.value.level !== null)

function clearFilters() {
  search.value = ''
  stateFilter.value = null
  zoneFilter.value = null
  levelKey.value = ALL
}

// Un niveau ou une zone qui disparaît (supprimé, renommé) ne doit pas laisser une liste vide.
watch(salle, value => {
  if (levelKey.value !== ALL && !value.niveaux.some(level => level.id === levelKey.value))
    levelKey.value = ALL
})

const levelOptions = computed(() => [{ value: ALL, title: 'Tous les niveaux' }, ...salle.value.niveaux.map(level => ({ value: level.id, title: level.nom }))])

/** Zones proposées au filtre : celles du niveau choisi (déclarées ou utilisées par des tables). */
const zoneOptions = computed(() => {
  const scope = filters.value.level
  const names = new Map<string, string>()

  for (const zone of salle.value.zones) {
    if (!scope || zone.niveau === scope)
      names.set(zone.nom.toLowerCase(), zone.nom)
  }

  for (const row of rows.value) {
    if (!scope || row.levelId === scope)
      names.set(row.zone.toLowerCase(), row.zone)
  }

  return [...names.values()].sort((a, b) => a.localeCompare(b, 'fr'))
})

watch(zoneOptions, options => {
  if (zoneFilter.value && !options.some(name => name.toLowerCase() === zoneFilter.value!.toLowerCase()))
    zoneFilter.value = null
})

const scoped = computed(() => filterRows(rows.value, filters.value, 'state'))
const filtered = computed(() => filterRows(rows.value, filters.value))

const STATE_ORDER: PlanState[] = ['free', 'busy', 'paying', 'reserved', 'settled', 'maintenance']

/** Pastilles d'état : celles qui ont des tables dans le périmètre choisi (et celle qui filtre déjà). */
const pills = computed(() => {
  const scopedCounts = stateCounts(scoped.value)

  return STATE_ORDER
    .filter(state => scopedCounts[state] > 0 || stateFilter.value === state)
    .map(state => ({ state, label: PLAN_STATE[state].label, color: PLAN_STATE[state].color, count: scopedCounts[state] }))
})

const summary = computed(() => {
  const seats = filtered.value.reduce((sum, row) => sum + row.capacity, 0)

  return `${plural(filtered.value.length, 'table')}${hasFilters.value ? ` sur ${rows.value.length}` : ''} · ${plural(seats, 'place')}`
})

// Tri et pagination ---------------------------------------------------------------------------

const sortKey = ref<SortKey>('zone')
const sortDirection = ref<'asc' | 'desc'>('asc')

function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'

    return
  }

  sortKey.value = key
  sortDirection.value = DEFAULT_DIRECTION[key]
}

const COLUMNS: { key: SortKey; label: string; class?: string }[] = [
  { key: 'numero', label: 'Table' },
  { key: 'zone', label: 'Zone' },
  { key: 'etat', label: 'État' },
  { key: 'places', label: 'Places' },
  { key: 'duree', label: 'En service', class: 'd-none d-lg-table-cell' },
]

const sortIcon = (key: SortKey) => sortKey.value !== key ? 'ri-expand-up-down-line' : sortDirection.value === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
const ariaSort = (key: SortKey) => sortKey.value !== key ? 'none' : sortDirection.value === 'asc' ? 'ascending' : 'descending'

const sorted = computed(() => sortRows(filtered.value, sortKey.value, sortDirection.value))
const pagination = useClientPagination(sorted, 10)

// Présentation d'une ligne ---------------------------------------------------------------------

const toneVar = (row: TableRow) => `var(--v-theme-${PLAN_STATE[row.state].color})`
const seatColor = (row: TableRow) => `rgb(var(--v-theme-${PLAN_STATE[row.state].color}))`
const zoneIcon = (row: TableRow) => (ZONE_TYPES.find(type => type.value === row.zoneType) ?? ZONE_TYPES[0]).icon

/** Les places libres d'une table servie se lisent en vert : c'est ce qu'on cherche pour installer quelqu'un. */
const seatClass = (row: TableRow) => row.covers !== null && row.free > 0 ? 'text-success' : 'text-medium-emphasis'

/** Mêmes tons que les pastilles de durée du plan : calme, à surveiller, trop long. */
const DURATION_TONE = { ok: 'dur--ok', warn: 'dur--warn', late: 'dur--late' } as const

// Création, modification, suppression -----------------------------------------------------------

const editing = ref<Table | null>(null)
const dialog = ref(false)
const batchDialog = ref(false)

function openForm(table: Table | null) {
  editing.value = table
  dialog.value = true
}

const defaultLevel = computed(() => filters.value.level ?? salle.value.niveaux[0].id)

/** Toutes les zones du restaurant, proposées dans le formulaire d'une table. */
const allZones = computed(() => [...new Set([...salle.value.zones.map(zone => zone.nom), ...rows.value.map(row => row.zone)])])

function zonesOfLevel(levelId: string): string[] {
  const names = new Set(salle.value.zones.filter(zone => zone.niveau === levelId).map(zone => zone.nom))

  for (const row of rows.value) {
    if (row.levelId === levelId)
      names.add(row.zone)
  }

  return [...names]
}
</script>

<template>
  <div class="tables-page">
    <AppHero
      eyebrow="Tables"
      title="Les tables de votre salle"
      subtitle="Places, zones, niveaux et état de chaque table, en direct."
      :live="isLive"
    >
      <template #eyebrow-extra>
        · {{ plural(totals.zones, 'zone') }} · {{ plural(totals.levels, 'niveau', 'niveaux') }}
      </template>
      <template #actions>
        <VBtn
          variant="text"
          prepend-icon="ri-layout-grid-line"
          to="/salle"
        >
          Plan de salle
        </VBtn>
        <VBtn
          v-if="canManage"
          variant="text"
          prepend-icon="ri-pencil-ruler-2-line"
          :to="{ path: '/salle', query: { amenager: '1' } }"
        >
          Aménager
        </VBtn>
        <VBtn
          v-if="canManage"
          variant="tonal"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
        <VBtn
          v-if="canManage"
          variant="tonal"
          prepend-icon="ri-stack-line"
          @click="batchDialog = true"
        >
          Ajouter en série
        </VBtn>
        <VBtn
          v-if="canManage"
          color="primary"
          prepend-icon="ri-add-line"
          data-tour="tables-add"
          @click="openForm(null)"
        >
          Nouvelle table
        </VBtn>
        <VBtn
          variant="text"
          color="secondary"
          icon="ri-refresh-line"
          aria-label="Actualiser"
          :loading="loading"
          @click="reload"
        />
      </template>
    </AppHero>

    <AppErrorState
      v-if="error && !data"
      class="mt-5"
      :error="error"
      @retry="reload"
    />

    <template v-else>
      <!-- Indicateurs : la structure de la salle d'un coup d'œil -->
      <AppMetricGrid
        class="mt-5"
        data-tour="tables-stats"
      >
        <template v-if="!data">
          <VCard
            v-for="n in 5"
            :key="n"
          >
            <VSkeletonLoader type="list-item-two-line" />
          </VCard>
        </template>
        <template v-else>
          <AppMetricTile
            hero
            label="Tables"
            icon="ri-layout-grid-line"
            :gauge="totals.occupancy"
            :gauge-label="`${totals.occupancy} % des tables sont servies`"
            :hint="`${plural(totals.serving, 'servie')} · ${plural(counts.free, 'libre')}`"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="totals.tables"
            >
              {{ current }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Places"
            icon="ri-armchair-line"
            color="info"
            :hint="`${totals.available} disponible${totals.available > 1 ? 's' : ''} maintenant`"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="totals.seats"
            >
              {{ current }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Zones"
            icon="ri-map-pin-line"
            color="warning"
            :hint="`sur ${plural(totals.levels, 'niveau', 'niveaux')}`"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="totals.zones"
            >
              {{ current }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Libres"
            icon="ri-checkbox-circle-line"
            color="success"
            :hint="counts.reserved ? plural(counts.reserved, 'réservée') : 'Prêtes à accueillir'"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="counts.free"
            >
              {{ current }}<span class="unit">/ {{ totals.tables }}</span>
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="À traiter"
            icon="ri-alert-line"
            :color="totals.attention ? 'warning' : 'success'"
            :hint="totals.attention ? `${counts.settled} à libérer · ${counts.maintenance} hors service` : 'Rien à traiter'"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="totals.attention"
            >
              {{ current }}
            </AppAnimatedNumber>
          </AppMetricTile>
        </template>
      </AppMetricGrid>

      <VCard class="list-card mt-5">
        <!-- Filtres -->
        <div
          class="toolbar"
          data-tour="tables-filters"
        >
          <div class="toolbar__row">
            <VTextField
              v-model="search"
              class="toolbar__search"
              placeholder="Rechercher une table, une zone, un niveau…"
              aria-label="Rechercher une table"
              prepend-inner-icon="ri-search-line"
              density="comfortable"
              hide-details
              clearable
              autocomplete="off"
            />
            <VSelect
              v-if="zoneOptions.length > 1"
              v-model="zoneFilter"
              class="toolbar__zone"
              :items="zoneOptions"
              label="Zone"
              prepend-inner-icon="ri-map-pin-line"
              density="comfortable"
              hide-details
              clearable
            />
            <div
              v-if="salle.niveaux.length > 1"
              class="toolbar__levels"
            >
              <AppSegmented
                v-model="levelKey"
                :options="levelOptions"
                label="Niveau"
              />
            </div>
          </div>
          <div class="toolbar__row toolbar__row--end">
            <FloorStatePills
              v-model="stateFilter"
              :items="pills"
              label="Filtrer par état"
            />
            <VSpacer />
            <span
              v-if="data"
              class="text-body-2 text-medium-emphasis"
            >{{ summary }}</span>
            <VBtn
              v-if="hasFilters"
              size="small"
              variant="text"
              color="secondary"
              prepend-icon="ri-filter-off-line"
              @click="clearFilters"
            >
              Effacer les filtres
            </VBtn>
          </div>
        </div>

        <VDivider />

        <VSkeletonLoader
          v-if="!data"
          type="table-thead, table-tbody"
        />

        <AppEmptyState
          v-else-if="!rows.length"
          icon="ri-layout-grid-line"
          title="Aucune table pour l'instant"
          text="Ajoutez vos tables une par une, en série ou par import Excel, puis placez-les sur le plan."
        >
          <div
            v-if="canManage"
            class="d-flex flex-wrap justify-center gap-3"
          >
            <VBtn
              color="primary"
              prepend-icon="ri-stack-line"
              @click="batchDialog = true"
            >
              Ajouter des tables
            </VBtn>
            <VBtn
              variant="outlined"
              prepend-icon="ri-upload-2-line"
              @click="importDialog = true"
            >
              Importer un fichier
            </VBtn>
          </div>
        </AppEmptyState>

        <AppEmptyState
          v-else-if="!filtered.length"
          icon="ri-filter-off-line"
          title="Aucune table ne correspond"
          text="Essayez d'autres mots ou retirez un filtre."
        >
          <VBtn
            variant="outlined"
            @click="clearFilters"
          >
            Effacer les filtres
          </VBtn>
        </AppEmptyState>

        <!-- Téléphone : une carte par table -->
        <div
          v-else-if="smAndDown"
          class="cards"
          data-tour="tables-list"
        >
          <article
            v-for="row in pagination.rows.value"
            :key="row.id"
            class="tcard"
            tabindex="0"
            :style="{ '--c': toneVar(row) }"
            @click="openForm(row.view.table)"
            @keydown.enter="openForm(row.view.table)"
          >
            <header class="tcard__head">
              <span
                class="num"
                :title="`Table ${row.numero}`"
              >{{ row.numero }}</span>
              <div class="min-w-0 flex-grow-1">
                <div class="d-flex align-center gap-1 font-weight-semibold">
                  <VIcon
                    :icon="zoneIcon(row)"
                    size="16"
                    class="text-medium-emphasis"
                  />
                  <span class="text-truncate">{{ row.zone }}</span>
                </div>
                <div
                  v-if="salle.niveaux.length > 1"
                  class="text-caption text-medium-emphasis"
                >
                  {{ row.levelName }}
                </div>
              </div>
              <VChip
                :color="PLAN_STATE[row.state].color"
                variant="tonal"
                size="small"
                label
              >
                {{ PLAN_STATE[row.state].label }}
              </VChip>
            </header>

            <div class="tcard__seats">
              <SeatRow
                size="sm"
                :capacity="row.capacity"
                :taken="row.covers"
                :color="seatColor(row)"
                :max="10"
              />
              <span
                class="text-body-2"
                :class="seatClass(row)"
              >{{ seatsLabel(row.view) }}</span>
            </div>

            <footer class="tcard__foot">
              <div class="d-flex flex-wrap align-center gap-2 min-w-0">
                <template v-if="row.sessionId && row.minutes !== null && row.tone">
                  <span
                    class="dur"
                    :class="DURATION_TONE[row.tone]"
                  >
                    <VIcon
                      icon="ri-timer-line"
                      size="14"
                    />{{ formatElapsed(row.minutes) }}
                  </span>
                  <span
                    v-if="row.covers"
                    class="text-caption text-medium-emphasis"
                  >{{ plural(row.covers, 'couvert') }}</span>
                  <RouterLink
                    :to="`/salle/sessions/${row.sessionId}`"
                    class="text-caption text-primary"
                    @click.stop
                  >
                    Voir la session
                  </RouterLink>
                </template>
                <span
                  v-else
                  class="text-caption text-medium-emphasis"
                >Pas de service en cours</span>
              </div>
              <div class="row-actions">
                <VBtn
                  icon="ri-map-pin-2-line"
                  size="small"
                  variant="text"
                  aria-label="Voir la table sur le plan"
                  :to="{ path: '/salle', query: { table: row.id } }"
                  @click.stop
                />
                <VBtn
                  icon="ri-pencil-line"
                  size="small"
                  variant="text"
                  aria-label="Modifier la table"
                  @click.stop="openForm(row.view.table)"
                />
                <VBtn
                  v-if="canManage"
                  icon="ri-delete-bin-line"
                  size="small"
                  variant="text"
                  color="error"
                  aria-label="Supprimer la table"
                  :disabled="designer.busy.value"
                  @click.stop="designer.deleteTable(row.view)"
                />
              </div>
            </footer>
          </article>
        </div>

        <!-- Écran large : tableau triable -->
        <VTable
          v-else
          class="tables-table"
          data-tour="tables-list"
        >
          <thead>
            <tr>
              <th
                v-for="column in COLUMNS"
                :key="column.key"
                :class="column.class"
                :aria-sort="ariaSort(column.key)"
              >
                <button
                  type="button"
                  class="th-sort"
                  :class="{ 'th-sort--on': sortKey === column.key }"
                  @click="sortBy(column.key)"
                >
                  {{ column.label }}
                  <VIcon
                    :icon="sortIcon(column.key)"
                    size="14"
                  />
                </button>
              </th>
              <th class="text-end">
                <span class="th-sort">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in pagination.rows.value"
              :key="row.id"
              class="trow"
              tabindex="0"
              :style="{ '--c': toneVar(row) }"
              @click="openForm(row.view.table)"
              @keydown.enter="openForm(row.view.table)"
            >
              <td>
                <span
                  class="num"
                  :title="`Table ${row.numero}`"
                >{{ row.numero }}</span>
              </td>
              <td>
                <div class="d-flex align-center gap-2">
                  <VIcon
                    :icon="zoneIcon(row)"
                    size="18"
                    class="text-medium-emphasis"
                  />
                  <div class="min-w-0">
                    <div class="font-weight-medium text-truncate">
                      {{ row.zone }}
                    </div>
                    <div
                      v-if="salle.niveaux.length > 1"
                      class="text-caption text-medium-emphasis"
                    >
                      {{ row.levelName }}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <VChip
                  :color="PLAN_STATE[row.state].color"
                  variant="tonal"
                  size="small"
                  label
                >
                  {{ PLAN_STATE[row.state].label }}
                </VChip>
              </td>
              <td>
                <div class="d-flex align-center gap-3">
                  <SeatRow
                    size="sm"
                    :capacity="row.capacity"
                    :taken="row.covers"
                    :color="seatColor(row)"
                    :max="10"
                  />
                  <span
                    class="text-body-2 text-no-wrap"
                    :class="seatClass(row)"
                  >{{ seatsLabel(row.view) }}</span>
                </div>
              </td>
              <td class="d-none d-lg-table-cell">
                <div
                  v-if="row.sessionId && row.minutes !== null && row.tone"
                  class="d-flex align-center gap-2"
                >
                  <span
                    class="dur"
                    :class="DURATION_TONE[row.tone]"
                  >
                    <VIcon
                      icon="ri-timer-line"
                      size="14"
                    />{{ formatElapsed(row.minutes) }}
                  </span>
                  <span
                    v-if="row.covers"
                    class="text-caption text-medium-emphasis text-no-wrap"
                  >{{ plural(row.covers, 'couvert') }}</span>
                  <RouterLink
                    :to="`/salle/sessions/${row.sessionId}`"
                    class="text-caption text-primary text-no-wrap"
                    @click.stop
                  >
                    Voir la session
                  </RouterLink>
                </div>
                <span
                  v-else
                  class="text-medium-emphasis"
                >—</span>
              </td>
              <td class="text-end">
                <div class="row-actions row-actions--end">
                  <VBtn
                    icon="ri-map-pin-2-line"
                    size="small"
                    variant="text"
                    aria-label="Voir la table sur le plan"
                    :to="{ path: '/salle', query: { table: row.id } }"
                    @click.stop
                  />
                  <VBtn
                    icon="ri-pencil-line"
                    size="small"
                    variant="text"
                    aria-label="Modifier la table"
                    @click.stop="openForm(row.view.table)"
                  />
                  <VBtn
                    v-if="canManage"
                    icon="ri-delete-bin-line"
                    size="small"
                    variant="text"
                    color="error"
                    aria-label="Supprimer la table"
                    :disabled="designer.busy.value"
                    @click.stop="designer.deleteTable(row.view)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </VTable>

        <template v-if="data && filtered.length">
          <VDivider />

          <AppTablePagination
            :page="pagination.page.value"
            :page-size="pagination.pageSize.value"
            :count="pagination.rows.value.length"
            :total="pagination.total.value"
            :pages="pagination.pages.value"
            :has-next="pagination.hasNext.value"
            @update:page="pagination.page.value = $event"
            @update:page-size="pagination.pageSize.value = $event"
          />
        </template>
      </VCard>
    </template>

    <AppImportDialog
      v-if="canManage"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="refresh"
    />
    <TableFormDialog
      v-model="dialog"
      :table="editing"
      :locations="allZones"
      :salle="salle"
      :designer="designer"
      :default-level="defaultLevel"
      :can-edit-layout="canManage"
      @saved="refresh"
    />
    <TablesBatchDialog
      v-model="batchDialog"
      :levels="salle.niveaux"
      :default-level="defaultLevel"
      :zones-of="zonesOfLevel"
      :existing="rows.map(row => row.numero)"
      :save="(levelId, spec) => designer.createTables(levelId, spec)"
    />
  </div>
</template>

<style scoped lang="scss">
/* Carte de la liste : coins larges et filet fin, comme le plan de salle et le tableau de bord. */
.tables-page :deep(.v-card:not(.tile)) {
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
}

.list-card {
  overflow: hidden;
}

// Filtres -------------------------------------------------------------------------------------

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.1rem 1.25rem;
}

.toolbar__row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
}

.toolbar__search {
  flex: 1 1 280px;
  min-inline-size: 0;
}

.toolbar__zone {
  flex: 0 1 220px;
  min-inline-size: 160px;
}

/* Beaucoup de niveaux : le contrôle défile au lieu de dépasser de la carte sur téléphone. */
.toolbar__levels {
  max-inline-size: 100%;
  min-inline-size: 0;
  overflow-x: auto;
}

// Liste ---------------------------------------------------------------------------------------

.tables-table {
  :deep(th) {
    background: rgba(var(--v-theme-on-surface), 0.03);
    border-block-end: 1px solid rgba(var(--v-border-color), 0.14);
    font-size: 0.75rem;
    height: 44px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  :deep(td) {
    block-size: 64px;
    border-block-end: 1px solid rgba(var(--v-border-color), 0.1);
  }
}

.th-sort {
  align-items: center;
  background: none;
  border: 0;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-weight: 700;
  gap: 0.25rem;
  letter-spacing: inherit;
  padding: 0;
  text-transform: inherit;

  &:is(button):hover,
  &--on {
    color: rgb(var(--v-theme-primary));
  }

  &:focus-visible {
    border-radius: 4px;
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 3px;
  }
}

.trow {
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(var(--v-theme-primary), 0.045);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: -2px;
  }
}

/* Le numéro porte la couleur de l'état, comme sur le plan et dans la fiche de la table. */
.num {
  align-items: center;
  background: rgba(var(--c), 0.14);
  border-radius: 12px;
  color: rgb(var(--c));
  display: inline-flex;
  font-size: 0.95rem;
  font-weight: 700;
  inline-size: auto;
  justify-content: center;
  max-inline-size: 110px;
  min-inline-size: 48px;
  overflow: hidden;
  padding: 0.5rem 0.65rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dur {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  font-size: 0.8rem;
  font-weight: 600;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  white-space: nowrap;

  &--ok {
    background: rgba(var(--v-theme-success), 0.14);
    color: rgb(var(--v-theme-success));
  }

  &--warn {
    background: rgba(var(--v-theme-warning), 0.16);
    color: rgb(var(--v-theme-warning));
  }

  &--late {
    background: rgba(var(--v-theme-error), 0.14);
    color: rgb(var(--v-theme-error));
  }
}

.row-actions {
  align-items: center;
  display: flex;
  gap: 2px;

  &--end {
    justify-content: flex-end;
  }
}

// Cartes (téléphone) ------------------------------------------------------------------------------

.cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.tcard {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-inline-start: 4px solid rgb(var(--c));
  border-radius: 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.85rem 0.9rem;

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }
}

.tcard__head {
  align-items: center;
  display: flex;
  gap: 0.75rem;
}

.tcard__seats {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.9rem;
}

.tcard__foot {
  align-items: center;
  border-block-start: 1px solid rgba(var(--v-border-color), 0.12);
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  padding-block-start: 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .trow {
    transition: none;
  }
}
</style>
