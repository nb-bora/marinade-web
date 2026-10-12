<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { useDisplay } from 'vuetify'
import { pressingApi } from '../api'
import MachineDrawer from '../components/MachineDrawer.vue'
import MachineFormDialog from '../components/MachineFormDialog.vue'
import MachineStateChip from '../components/MachineStateChip.vue'
import {
  CATEGORY_INFO,
  CATEGORY_OPTIONS,
  MODE_INFO,
  STATE_INFO,
  STATE_OPTIONS,
  formatCapacity,
  normalize,
  plural,
  pressingError,
} from '../labels'
import type { Machine, MachineCategory, MachineState } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { useConfirm } from '@/composables/useConfirm'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

type DrawerTab = 'fiche' | 'etat' | 'maintenance' | 'historique'

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()
const { smAndDown } = useDisplay()

const canWrite = computed(() => tenant.can('management'))

// --- Filtres -----------------------------------------------------------------------------------------

const route = useRoute()

const search = ref('')
const searchDebounced = refDebounced(search, 200)
const category = ref<MachineCategory | null>(null)
const queryState = route.query.etat
const state = ref<MachineState | null>(typeof queryState === 'string' && queryState in STATE_INFO ? queryState as MachineState : null)
const status = ref<'actives' | 'inactives' | 'toutes'>('actives')

const statusItems = [
  { value: 'actives', title: 'Actives' },
  { value: 'inactives', title: 'Désactivées' },
  { value: 'toutes', title: 'Toutes' },
]

// Catégorie, état et statut sont filtrés par le serveur ; la recherche se fait en mémoire.
const { data, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId
    ? pressingApi.machines(tenant.currentId, {
      categorie: category.value ?? undefined,
      etat: state.value ?? undefined,
      actif: status.value === 'toutes' ? undefined : status.value === 'actives',
    }, signal)
    : Promise.resolve([] as Machine[]),
  { watch: [() => tenant.currentId, category, state, status] },
)

const zonesData = useAsyncData(
  signal => tenant.currentId ? pressingApi.zones(tenant.currentId, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

const zones = computed(() => zonesData.data.value ?? [])
const zoneNames = computed(() => new Map(zones.value.map(zone => [zone.id, zone.nom])))

const machines = computed(() => data.value ?? [])
const loadedOnce = computed(() => data.value !== null)

const filtered = computed(() => {
  const term = normalize(searchDebounced.value.trim())

  return machines.value
    .filter(machine => !term || normalize(`${machine.nom} ${machine.marque ?? ''} ${machine.modele ?? ''} ${machine.numero_serie ?? ''}`).includes(term))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' }))
})

const pagination = useClientPagination(filtered, 10)

const hasFilters = computed(() => !!search.value || !!category.value || !!state.value || status.value !== 'actives')

function clearFilters() {
  search.value = ''
  category.value = null
  state.value = null
  status.value = 'actives'
}

// --- Fiche, formulaire ------------------------------------------------------------------------------

// `?machine=<id>` ouvre directement la fiche (liens du tableau de bord).
const drawerId = ref<string | null>(typeof route.query.machine === 'string' ? route.query.machine : null)
const drawerTab = ref<DrawerTab>('fiche')
const revision = ref(0)

function openDrawer(machine: Machine, tab: DrawerTab = 'fiche') {
  drawerTab.value = tab
  drawerId.value = machine.id
}

const formOpen = ref(false)
const edited = ref<Machine | null>(null)

function newMachine() {
  edited.value = null
  formOpen.value = true
}

function editMachine(machine: Machine) {
  edited.value = machine
  formOpen.value = true
}

// Rafraîchissement discret : l'état des machines change pendant la journée.
useLive(() => {
  if (!formOpen.value)
    refresh()
})

async function onSaved() {
  revision.value++
  await Promise.all([refresh(), zonesData.refresh()])
}

// --- Désactivation ----------------------------------------------------------------------------------

const BUSY: readonly MachineState[] = ['reservee', 'en_cycle']

const isBusy = (machine: Machine) => BUSY.includes(machine.etat_operationnel)

const deactivation = useSubmit(async (machine: Machine) => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return

  const accepted = await confirm({
    title: 'Désactiver cette machine ?',
    text: `« ${machine.nom} » disparaîtra du plan et ne pourra plus recevoir de linge. Son historique est conservé.`,
    confirmLabel: 'Désactiver',
    danger: true,
  })

  if (!accepted)
    return

  await pressingApi.deactivateMachine(restaurantId, machine.id)
  toast.success(`« ${machine.nom} » est désactivée.`)
  await refresh()
})

watch(deactivation.error, value => {
  if (value)
    toast.error(pressingError(value))
})

const subtitle = computed(() => loadedOnce.value
  ? `${plural(filtered.value.length, 'machine')}${filtered.value.length !== machines.value.length ? ` sur ${machines.value.length}` : ''} dans le parc.`
  : 'Lave-linge et sèche-linge de votre pressing.')

const modeText = (machine: Machine) => MODE_INFO[machine.type_fonctionnement].label
</script>

<template>
  <div>
    <AppPageHeader
      title="Machines du pressing"
      :subtitle="subtitle"
    >
      <template
        v-if="canWrite"
        #actions
      >
        <VBtn
          prepend-icon="ri-add-line"
          data-testid="machines-add"
          data-tour="machines-add"
          @click="newMachine"
        >
          Ajouter une machine
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard>
      <VCardItem class="pb-2">
        <VCardTitle>Filtres</VCardTitle>
      </VCardItem>
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="3"
          >
            <VTextField
              v-model="search"
              label="Rechercher"
              placeholder="Nom, marque, modèle, série"
              prepend-inner-icon="ri-search-line"
              clearable
              autocomplete="off"
              data-testid="machines-search"
            />
          </VCol>
          <VCol
            cols="12"
            sm="4"
            md="3"
          >
            <VSelect
              v-model="category"
              :items="CATEGORY_OPTIONS"
              item-value="value"
              label="Catégorie"
              prepend-inner-icon="ri-t-shirt-air-line"
              placeholder="Toutes les catégories"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="4"
            md="3"
          >
            <VSelect
              v-model="state"
              :items="STATE_OPTIONS"
              item-value="value"
              label="État"
              prepend-inner-icon="ri-pulse-line"
              placeholder="Tous les états"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="4"
            md="3"
          >
            <VSelect
              v-model="status"
              :items="statusItems"
              label="Statut"
              prepend-inner-icon="ri-filter-3-line"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <div
        v-if="hasFilters"
        class="d-flex justify-end px-5 py-3"
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-filter-off-line"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
      </div>

      <AppErrorState
        v-if="error && !loadedOnce"
        class="ma-4"
        :error="error"
        @retry="reload"
      />

      <VSkeletonLoader
        v-else-if="!loadedOnce"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="filtered.length === 0"
        icon="ri-t-shirt-air-line"
        :title="hasFilters ? 'Aucune machine ne correspond' : 'Aucune machine pour l\'instant'"
        :text="hasFilters
          ? 'Essayez d\'autres filtres ou une autre recherche.'
          : canWrite ? 'Ajoutez vos lave-linge et sèche-linge avec leur fiche technique : capacité, programmes, consommation.' : 'La direction n\'a pas encore ajouté de machines.'"
      >
        <VBtn
          v-if="hasFilters"
          variant="outlined"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
        <VBtn
          v-else-if="canWrite"
          prepend-icon="ri-add-line"
          @click="newMachine"
        >
          Ajouter une machine
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <!-- Téléphone : une carte par machine -->
        <div
          v-if="smAndDown"
          class="d-flex flex-column gap-3 pa-4"
          data-testid="machines-cards"
        >
          <VCard
            v-for="machine in pagination.rows.value"
            :key="machine.id"
            variant="outlined"
            :class="{ 'opacity-60': !machine.actif }"
          >
            <VCardText class="d-flex align-start gap-3">
              <VAvatar
                :color="CATEGORY_INFO[machine.categorie].color"
                variant="tonal"
                rounded
              >
                <VIcon :icon="CATEGORY_INFO[machine.categorie].icon" />
              </VAvatar>
              <button
                type="button"
                class="machine-card__main min-w-0 flex-grow-1 text-start"
                :aria-label="`Ouvrir la fiche de ${machine.nom}`"
                @click="openDrawer(machine)"
              >
                <span class="d-block text-body-1 font-weight-medium text-high-emphasis machine-name">{{ machine.nom }}</span>
                <span class="d-block text-body-2 text-medium-emphasis">
                  {{ CATEGORY_INFO[machine.categorie].label }} · {{ formatCapacity(machine.capacite_kg) }}
                </span>
                <span class="d-block text-body-2 text-medium-emphasis">
                  {{ modeText(machine) }}<template v-if="machine.zone_id && zoneNames.get(machine.zone_id)"> · {{ zoneNames.get(machine.zone_id) }}</template>
                </span>
                <span class="d-flex flex-wrap gap-2 mt-2">
                  <MachineStateChip :state="machine.etat_operationnel" />
                  <VChip
                    v-if="!machine.actif"
                    size="small"
                    label
                    variant="tonal"
                    color="error"
                  >Désactivée</VChip>
                </span>
              </button>
              <VMenu>
                <template #activator="{ props: menuProps }">
                  <IconBtn
                    v-bind="menuProps"
                    :aria-label="`Actions pour ${machine.nom}`"
                  >
                    <VIcon icon="ri-more-2-fill" />
                  </IconBtn>
                </template>
                <VList density="compact">
                  <VListItem
                    prepend-icon="ri-file-list-3-line"
                    title="Fiche"
                    @click="openDrawer(machine)"
                  />
                  <VListItem
                    prepend-icon="ri-pulse-line"
                    :title="canWrite ? 'Changer l\'état' : 'Voir l\'état'"
                    @click="openDrawer(machine, 'etat')"
                  />
                  <VListItem
                    prepend-icon="ri-tools-line"
                    title="Maintenance"
                    @click="openDrawer(machine, 'maintenance')"
                  />
                  <template v-if="canWrite && machine.actif">
                    <VListItem
                      prepend-icon="ri-edit-line"
                      title="Modifier"
                      @click="editMachine(machine)"
                    />
                    <VListItem
                      prepend-icon="ri-forbid-line"
                      title="Désactiver"
                      base-color="error"
                      :disabled="isBusy(machine)"
                      :subtitle="isBusy(machine) ? `Impossible : ${STATE_INFO[machine.etat_operationnel].label.toLowerCase()}` : undefined"
                      @click="deactivation.submit(machine)"
                    />
                  </template>
                </VList>
              </VMenu>
            </VCardText>
          </VCard>
        </div>

        <!-- Ordinateur : tableau -->
        <VTable
          v-else
          hover
          data-testid="machines-table"
        >
          <thead>
            <tr>
              <th>Machine</th>
              <th>Catégorie</th>
              <th class="d-none d-lg-table-cell">
                Fonctionnement
              </th>
              <th class="text-end">
                Capacité
              </th>
              <th>État</th>
              <th class="d-none d-lg-table-cell">
                Zone
              </th>
              <th class="text-end">
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="machine in pagination.rows.value"
              :key="machine.id"
              class="cursor-pointer"
              :class="{ 'opacity-60': !machine.actif }"
              tabindex="0"
              :aria-label="`Fiche de ${machine.nom}`"
              data-testid="machine-row"
              @click="openDrawer(machine)"
              @keydown.enter="openDrawer(machine)"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    :color="CATEGORY_INFO[machine.categorie].color"
                    variant="tonal"
                    rounded
                  >
                    <VIcon :icon="CATEGORY_INFO[machine.categorie].icon" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis">
                      {{ machine.nom }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ [machine.marque, machine.modele].filter(Boolean).join(' ') || 'Marque et modèle non renseignés' }}
                    </div>
                  </div>
                </div>
              </td>
              <td>{{ CATEGORY_INFO[machine.categorie].label }}</td>
              <td class="d-none d-lg-table-cell">
                {{ modeText(machine) }}
              </td>
              <td class="text-end text-no-wrap tabular-nums">
                {{ formatCapacity(machine.capacite_kg) }}
              </td>
              <td>
                <div class="d-flex flex-wrap align-center gap-2">
                  <MachineStateChip :state="machine.etat_operationnel" />
                  <VChip
                    v-if="!machine.actif"
                    size="small"
                    label
                    variant="tonal"
                    color="error"
                  >
                    Désactivée
                  </VChip>
                </div>
              </td>
              <td class="d-none d-lg-table-cell">
                {{ machine.zone_id ? zoneNames.get(machine.zone_id) ?? '—' : '—' }}
              </td>
              <td class="text-end">
                <VMenu>
                  <template #activator="{ props: menuProps }">
                    <IconBtn
                      v-bind="menuProps"
                      :aria-label="`Actions pour ${machine.nom}`"
                      @click.stop
                      @keydown.enter.stop
                    >
                      <VIcon icon="ri-more-2-fill" />
                    </IconBtn>
                  </template>
                  <VList density="compact">
                    <VListItem
                      prepend-icon="ri-file-list-3-line"
                      title="Fiche"
                      @click="openDrawer(machine)"
                    />
                    <VListItem
                      prepend-icon="ri-pulse-line"
                      :title="canWrite ? 'Changer l\'état' : 'Voir l\'état'"
                      @click="openDrawer(machine, 'etat')"
                    />
                    <VListItem
                      prepend-icon="ri-tools-line"
                      title="Maintenance"
                      @click="openDrawer(machine, 'maintenance')"
                    />
                    <template v-if="canWrite && machine.actif">
                      <VListItem
                        prepend-icon="ri-edit-line"
                        title="Modifier"
                        @click="editMachine(machine)"
                      />
                      <VListItem
                        prepend-icon="ri-forbid-line"
                        title="Désactiver"
                        base-color="error"
                        :disabled="isBusy(machine)"
                        :subtitle="isBusy(machine) ? `Impossible : ${STATE_INFO[machine.etat_operationnel].label.toLowerCase()}` : undefined"
                        @click="deactivation.submit(machine)"
                      />
                    </template>
                  </VList>
                </VMenu>
              </td>
            </tr>
          </tbody>
        </VTable>

        <AppTablePagination
          v-model:page="pagination.page.value"
          v-model:page-size="pagination.pageSize.value"
          :count="pagination.rows.value.length"
          :total="pagination.total.value"
          :pages="pagination.pages.value"
          :has-next="pagination.hasNext.value"
        />
      </template>
    </VCard>

    <MachineDrawer
      v-model="drawerId"
      :zones="zones"
      :can-write="canWrite"
      :revision="revision"
      :start-tab="drawerTab"
      @changed="onSaved"
      @edit="editMachine"
    />

    <MachineFormDialog
      v-model="formOpen"
      :machine="edited"
      :zones="zones"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.machine-card__main {
  cursor: pointer;
}

.machine-name {
  overflow-wrap: anywhere;
}
</style>
