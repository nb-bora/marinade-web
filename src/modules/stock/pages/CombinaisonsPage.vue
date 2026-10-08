<script setup lang="ts">
import { stockApi } from '../api'
import CombinaisonFormDialog from '../components/CombinaisonFormDialog.vue'
import type { Combinaison, Composant } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const canWrite = computed(() => tenant.can('management'))

const all = useAsyncData(
  signal => tenant.currentId ? stockApi.combinaisons(tenant.currentId, signal) : Promise.resolve([] as Combinaison[]),
  { watch: [() => tenant.currentId] },
)

const recommended = useAsyncData(
  signal => tenant.currentId ? stockApi.recommendations(tenant.currentId, signal) : Promise.resolve([] as Combinaison[]),
  { watch: [() => tenant.currentId] },
)

const composants = useAsyncData(
  signal => tenant.currentId ? stockApi.composants(tenant.currentId, signal) : Promise.resolve([] as Composant[]),
  { watch: [() => tenant.currentId] },
)

const nameById = computed(() => new Map((composants.data.value ?? []).map(item => [item.id, item.nom])))
const recommendedIds = computed(() => new Set((recommended.data.value ?? []).map(item => item.id)))

const names = (item: Combinaison) => item.composant_ids.map(id => nameById.value.get(id) ?? 'Composant supprimé')

interface Sale { label: string; tone: 'success' | 'warning' | 'neutral'; icon: string }

function saleOf(item: Combinaison): Sale {
  if (!item.disponible)
    return { label: 'Désactivée', tone: 'neutral', icon: 'ri-pause-circle-line' }

  return recommendedIds.value.has(item.id)
    ? { label: 'En vente', tone: 'success', icon: 'ri-checkbox-circle-line' }
    : { label: 'Stock insuffisant', tone: 'warning', icon: 'ri-alarm-warning-line' }
}

const search = ref('')
const loadedOnce = computed(() => all.data.value !== null)

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()

  return (all.data.value ?? [])
    .filter(item => !term || item.nom.toLowerCase().includes(term))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})

const pager = useClientPagination(filtered, 10)

const editing = ref<Combinaison | null>(null)
const dialogOpen = ref(false)

function openDialog(item: Combinaison | null) {
  editing.value = item
  dialogOpen.value = true
}

function reloadAll() {
  all.reload()
  recommended.reload()
  composants.reload()
}

function afterSave() {
  all.refresh()
  recommended.refresh()
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Combinaisons"
      subtitle="Des offres à prix unique composées de plusieurs composants. Une offre dont un composant manque n'est plus proposée."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="all.loading.value"
          @click="reloadAll"
        >
          Actualiser
        </VBtn>
        <VBtn
          v-if="canWrite"
          color="primary"
          prepend-icon="ri-add-line"
          @click="openDialog(null)"
        >
          Nouvelle combinaison
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="all.error.value && !loadedOnce"
      :error="all.error.value"
      @retry="reloadAll"
    />

    <template v-else>
      <VCard
        v-if="loadedOnce"
        class="recommended"
      >
        <VCardItem>
          <template #prepend>
            <VAvatar
              color="success"
              variant="tonal"
              rounded
            >
              <VIcon icon="ri-thumb-up-line" />
            </VAvatar>
          </template>
          <VCardTitle>Vendables en ce moment</VCardTitle>
          <VCardSubtitle>Offres actives dont tous les composants sont en stock</VCardSubtitle>
        </VCardItem>
        <VCardText>
          <VSkeletonLoader
            v-if="recommended.data.value === null"
            type="list-item-two-line"
          />
          <p
            v-else-if="recommended.data.value.length === 0"
            class="text-body-2 text-medium-emphasis mb-0"
          >
            Aucune combinaison n'est vendable pour l'instant : activez une offre ou réapprovisionnez ses composants.
          </p>
          <VRow v-else>
            <VCol
              v-for="item in recommended.data.value"
              :key="item.id"
              cols="12"
              sm="6"
              lg="4"
            >
              <div class="recommended__item pa-4">
                <div class="d-flex justify-space-between align-start gap-3">
                  <div class="text-body-1 font-weight-semibold text-high-emphasis min-w-0">
                    {{ item.nom }}
                  </div>
                  <span class="text-body-1 font-weight-semibold text-primary tabular-nums text-no-wrap">
                    {{ formatMoney(item.prix, item.devise) }}
                  </span>
                </div>
                <div class="d-flex flex-wrap gap-1 mt-2">
                  <VChip
                    v-for="name in names(item)"
                    :key="name"
                    size="small"
                    label
                  >
                    {{ name }}
                  </VChip>
                </div>
              </div>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <VCard class="mt-6">
        <VCardItem class="pb-2">
          <VCardTitle>Toutes les combinaisons</VCardTitle>
        </VCardItem>
        <VCardText>
          <VTextField
            v-model="search"
            label="Rechercher une combinaison"
            prepend-inner-icon="ri-search-line"
            clearable
            autocomplete="off"
          />
        </VCardText>

        <VDivider />

        <VSkeletonLoader
          v-if="!loadedOnce"
          type="table-thead, table-tbody"
        />

        <AppEmptyState
          v-else-if="filtered.length === 0"
          icon="ri-restaurant-2-line"
          :title="search ? 'Aucune combinaison ne correspond' : 'Aucune combinaison pour l\'instant'"
          :text="search ? 'Essayez un autre mot.' : 'Composez une offre à prix unique à partir de vos composants.'"
        >
          <VBtn
            v-if="!search && canWrite"
            color="primary"
            prepend-icon="ri-add-line"
            @click="openDialog(null)"
          >
            Nouvelle combinaison
          </VBtn>
        </AppEmptyState>

        <template v-else>
          <VTable hover>
            <thead>
              <tr>
                <th>Combinaison</th>
                <th class="d-none d-md-table-cell">
                  Composants
                </th>
                <th class="text-end">
                  Prix
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
                      <VIcon icon="ri-restaurant-2-line" />
                    </VAvatar>
                    <div class="min-w-0">
                      <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate">
                        {{ item.nom }}
                      </div>
                      <div class="text-body-2 text-medium-emphasis">
                        {{ item.composant_ids.length }} composant{{ item.composant_ids.length > 1 ? 's' : '' }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="d-none d-md-table-cell">
                  <div class="d-flex flex-wrap gap-1 py-2">
                    <VChip
                      v-for="name in names(item)"
                      :key="name"
                      size="small"
                      label
                    >
                      {{ name }}
                    </VChip>
                  </div>
                </td>
                <td class="text-end font-weight-semibold text-high-emphasis tabular-nums">
                  {{ formatMoney(item.prix, item.devise) }}
                </td>
                <td>
                  <AppStatusChip
                    :label="saleOf(item).label"
                    :tone="saleOf(item).tone"
                    :icon="saleOf(item).icon"
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
    </template>

    <CombinaisonFormDialog
      v-model="dialogOpen"
      :combinaison="editing"
      :composants="composants.data.value ?? []"
      @saved="afterSave"
    />
  </div>
</template>

<style scoped>
.recommended {
  border: 1px solid rgba(var(--v-theme-success), 0.35);
}

.recommended__item {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  background: rgba(var(--v-theme-success), 0.05);
  block-size: 100%;
}
</style>
