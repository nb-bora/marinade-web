<script setup lang="ts">
import TableFormDialog from '../components/TableFormDialog.vue'
import { useFloorData } from '../composables/useFloorData'
import { tablesImport } from '../imports'
import { TABLE_STATE, TABLE_STATUS_OPTIONS, plural } from '../labels'
import { locationOf, tableState } from '../service'
import type { Table, TableView } from '../types'
import { useClientPagination } from '@/composables/useClientPagination'
import { useLive } from '@/composables/useLive'
import { formatRelative } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const importDialog = ref(false)
const importDefinition = tablesImport()

const { data, loading, error, reload, refresh } = useFloorData(false)

useLive(refresh)

const search = ref('')
const searchDebounced = refDebounced(search, 250)
const status = ref<string | null>(null)

const views = computed(() => data.value?.views ?? [])
const locations = computed(() => [...new Set(views.value.map(view => locationOf(view.table)))])
const hasFilters = computed(() => searchDebounced.value.trim() !== '' || status.value !== null)

const filtered = computed(() => {
  const query = searchDebounced.value.trim().toLowerCase()

  return views.value.filter(view =>
    (!query || `${view.table.numero} ${view.table.emplacement ?? ''}`.toLowerCase().includes(query))
    && (status.value === null || tableState(view) === status.value))
})

const pagination = useClientPagination(filtered, 10)

function clearFilters() {
  search.value = ''
  status.value = null
}

// Création et modification ---------------------------------------------------------------

const editing = ref<Table | null>(null)
const dialog = ref(false)

function openForm(table: Table | null) {
  editing.value = table
  dialog.value = true
}

const rowOf = (view: TableView) => ({
  view,
  state: TABLE_STATE[tableState(view)],
})

const STATE_OPTIONS = [...TABLE_STATUS_OPTIONS, { value: 'settled', title: TABLE_STATE.settled.label }]
</script>

<template>
  <div>
    <AppPageHeader
      title="Tables"
      subtitle="Les tables de votre salle : places, emplacement et état."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="loading"
          @click="reload"
        >
          Actualiser
        </VBtn>
        <VBtn
          variant="outlined"
          to="/salle"
          prepend-icon="ri-layout-grid-line"
        >
          Plan de salle
        </VBtn>
        <VBtn
          v-if="tenant.can('management')"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
        <VBtn
          v-if="tenant.can('management')"
          color="primary"
          prepend-icon="ri-add-line"
          @click="openForm(null)"
        >
          Nouvelle table
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
            md="6"
          >
            <VTextField
              v-model="search"
              label="Numéro ou emplacement"
              prepend-inner-icon="ri-search-line"
              clearable
              autocomplete="off"
            />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <VSelect
              v-model="status"
              :items="STATE_OPTIONS"
              label="État"
              prepend-inner-icon="ri-filter-3-line"
              clearable
              placeholder="Tous les états"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <div class="d-flex flex-wrap align-center gap-3 px-5 py-4">
        <span class="text-body-1 text-medium-emphasis">
          <template v-if="data">
            {{ plural(filtered.length, 'table') }}<template v-if="hasFilters"> sur {{ views.length }}</template>
          </template>
        </span>
        <VSpacer />
        <VBtn
          v-if="hasFilters"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-filter-off-line"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
      </div>

      <AppErrorState
        v-if="error && !data"
        class="ma-4"
        :error="error"
        @retry="reload"
      />

      <VSkeletonLoader
        v-else-if="!data"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="!filtered.length"
        icon="ri-layout-grid-line"
        :title="hasFilters ? 'Aucune table ne correspond' : 'Aucune table pour l\'instant'"
        :text="hasFilters ? 'Essayez d\'autres filtres.' : 'Ajoutez les tables de votre salle pour pouvoir y ouvrir des sessions.'"
      >
        <VBtn
          v-if="hasFilters"
          variant="outlined"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
        <VBtn
          v-else-if="tenant.can('management')"
          color="primary"
          prepend-icon="ri-add-line"
          @click="openForm(null)"
        >
          Ajouter une table
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable
          hover
          class="tables-table"
        >
          <thead>
            <tr>
              <th>Table</th>
              <th>État</th>
              <th class="text-end d-none d-sm-table-cell">
                Places
              </th>
              <th class="d-none d-md-table-cell">
                Session
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in pagination.rows.value.map(rowOf)"
              :key="row.view.table.id"
              class="cursor-pointer"
              tabindex="0"
              @click="openForm(row.view.table)"
              @keydown.enter="openForm(row.view.table)"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    :color="row.state.tone === 'neutral' ? 'secondary' : row.state.tone"
                    variant="tonal"
                    rounded
                    size="38"
                  >
                    <VIcon :icon="row.state.icon" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis">
                      {{ row.view.table.numero }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ locationOf(row.view.table) }}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <AppStatusChip v-bind="row.state" />
              </td>
              <td class="text-end d-none d-sm-table-cell">
                {{ row.view.table.capacite }}
              </td>
              <td class="d-none d-md-table-cell text-medium-emphasis">
                <template v-if="row.view.session">
                  <RouterLink
                    :to="`/salle/sessions/${row.view.session.id}`"
                    class="text-primary"
                    @click.stop
                  >
                    Voir la session
                  </RouterLink>
                  · ouverte {{ formatRelative(row.view.session.opened_at) }}
                </template>
                <template v-else>
                  —
                </template>
              </td>
            </tr>
          </tbody>
        </VTable>

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

    <AppImportDialog
      v-if="tenant.can('management')"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="refresh"
    />
    <TableFormDialog
      v-model="dialog"
      :table="editing"
      :locations="locations"
      :can-edit-layout="tenant.can('management')"
      @saved="refresh"
    />
  </div>
</template>
