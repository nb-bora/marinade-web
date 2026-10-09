<script setup lang="ts">
import { stockApi } from '../api'
import ComposantFormDialog from '../components/ComposantFormDialog.vue'
import { composantsImport } from '../imports'
import { componentTypeLabel } from '../labels'
import type { Composant } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()

const { data, loading, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId ? stockApi.composants(tenant.currentId, signal) : Promise.resolve([] as Composant[]),
  { watch: [() => tenant.currentId] },
)

const search = ref('')
const importDialog = ref(false)
const importDefinition = composantsImport()
const canWrite = computed(() => tenant.can('management'))
const loadedOnce = computed(() => data.value !== null)

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()

  return (data.value ?? [])
    .filter(item => !term || item.nom.toLowerCase().includes(term) || item.type.toLowerCase().includes(term))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})

const pager = useClientPagination(filtered, 10)

const editing = ref<Composant | null>(null)
const dialogOpen = ref(false)

function openDialog(composant: Composant | null) {
  editing.value = composant
  dialogOpen.value = true
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Composants"
      subtitle="Les bases, sauces, protéines et autres éléments qui composent vos plats et vos combinaisons."
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
          v-if="canWrite"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
        <VBtn
          v-if="canWrite"
          color="primary"
          prepend-icon="ri-add-line"
          @click="openDialog(null)"
        >
          Nouveau composant
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard>
      <VCardItem class="pb-2">
        <VCardTitle>Liste des composants</VCardTitle>
        <VCardSubtitle v-if="loadedOnce">
          {{ data?.length ?? 0 }} composant{{ (data?.length ?? 0) > 1 ? 's' : '' }}
        </VCardSubtitle>
      </VCardItem>
      <VCardText>
        <VTextField
          v-model="search"
          label="Rechercher par nom ou catégorie"
          prepend-inner-icon="ri-search-line"
          clearable
          autocomplete="off"
        />
      </VCardText>

      <VDivider />

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
        icon="ri-stack-line"
        :title="search ? 'Aucun composant ne correspond' : 'Aucun composant pour l\'instant'"
        :text="search ? 'Essayez un autre mot.' : 'Ajoutez les éléments de vos plats pour suivre leur stock et composer des offres.'"
      >
        <VBtn
          v-if="!search && canWrite"
          color="primary"
          prepend-icon="ri-add-line"
          @click="openDialog(null)"
        >
          Nouveau composant
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable hover>
          <thead>
            <tr>
              <th>Composant</th>
              <th class="d-none d-sm-table-cell">
                Unité
              </th>
              <th class="text-end d-none d-md-table-cell">
                Supplément
              </th>
              <th>Statut</th>
              <th
                v-if="canWrite"
                class="text-end"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in pager.rows.value"
              :key="item.id"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    rounded
                    size="38"
                  >
                    <VIcon icon="ri-stack-line" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate">
                      {{ item.nom }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ componentTypeLabel(item.type) }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="d-none d-sm-table-cell text-medium-emphasis">
                {{ item.stock_unite }}
              </td>
              <td class="text-end d-none d-md-table-cell tabular-nums">
                {{ Number(item.prix_supplement) > 0 ? `+ ${formatMoney(item.prix_supplement, item.devise)}` : '—' }}
              </td>
              <td>
                <AppStatusChip
                  :label="item.disponible ? 'Proposé' : 'Masqué'"
                  :tone="item.disponible ? 'success' : 'neutral'"
                />
              </td>
              <td
                v-if="canWrite"
                class="text-end"
              >
                <IconBtn
                  :aria-label="`Modifier ${item.nom}`"
                  @click="openDialog(item)"
                >
                  <VIcon icon="ri-edit-line" />
                  <VTooltip
                    activator="parent"
                    location="top"
                  >
                    Modifier
                  </VTooltip>
                </IconBtn>
              </td>
            </tr>
          </tbody>
        </VTable>

        <VDivider />

        <AppTablePagination
          :page="pager.page.value"
          :page-size="pager.pageSize.value"
          :count="pager.rows.value.length"
          :total="pager.total.value"
          :pages="pager.pages.value"
          :has-next="pager.hasNext.value"
          @update:page="pager.page.value = $event"
          @update:page-size="pager.pageSize.value = $event"
        />
      </template>
    </VCard>

    <AppImportDialog
      v-if="canWrite"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="refresh"
    />

    <ComposantFormDialog
      v-model="dialogOpen"
      :composant="editing"
      @saved="refresh"
    />
  </div>
</template>
