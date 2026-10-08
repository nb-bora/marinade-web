<script setup lang="ts">
import { platformApi } from '../api'
import PrefixFormDialog from '../components/PrefixFormDialog.vue'
import type { OperatorPrefix } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatDate } from '@/lib/format'
import { useToast } from '@/stores/toast.store'

const toast = useToast()
const confirm = useConfirm()

const { data, loading, error, reload, refresh } = useAsyncData(signal => platformApi.prefixes(signal))

const search = ref('')

const filtered = computed(() => {
  const needle = search.value.trim().toLowerCase()

  return [...(data.value ?? [])]
    .filter(item => !needle || `${item.national_prefix} ${item.operator_name} ${item.operator_code}`.toLowerCase().includes(needle))
    .sort((a, b) => a.operator_code.localeCompare(b.operator_code) || a.national_prefix.localeCompare(b.national_prefix))
})

const { page, pageSize, total, pages, rows, hasNext } = useClientPagination(filtered, 10)

const dialog = ref(false)
const edited = ref<OperatorPrefix | null>(null)

function create() {
  edited.value = null
  dialog.value = true
}

function edit(prefix: OperatorPrefix) {
  edited.value = prefix
  dialog.value = true
}

const busyId = ref<string | null>(null)

const toggle = useSubmit(async (prefix: OperatorPrefix) => {
  const accepted = await confirm({
    title: prefix.is_active ? `Désactiver le préfixe ${prefix.national_prefix} ?` : `Réactiver le préfixe ${prefix.national_prefix} ?`,
    text: prefix.is_active
      ? 'Les numéros commençant par ce préfixe ne seront plus reconnus comme appartenant à cet opérateur.'
      : 'Les numéros commençant par ce préfixe seront de nouveau reconnus.',
    confirmLabel: prefix.is_active ? 'Supprimer' : 'Enregistrer',
    danger: prefix.is_active,
  })

  if (!accepted)
    return

  busyId.value = prefix.id
  try {
    await platformApi.updatePrefix(prefix.id, { is_active: !prefix.is_active })
    toast.success(prefix.is_active ? 'Préfixe désactivé.' : 'Préfixe réactivé.')
    await refresh()
  }
  finally {
    busyId.value = null
  }
})

watch(toggle.error, cause => {
  if (cause)
    toast.error(cause)
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Opérateurs mobiles"
      subtitle="Les préfixes qui permettent de reconnaître MTN ou Orange à partir d'un numéro de téléphone."
    >
      <template #actions>
        <VBtn
          prepend-icon="ri-add-line"
          @click="create"
        >
          Nouveau préfixe
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard>
      <VCardItem class="pb-2">
        <VCardTitle>Préfixes</VCardTitle>
        <VCardSubtitle v-if="data !== null">
          {{ data.length }} préfixe{{ data.length > 1 ? 's' : '' }}, actifs ou non
        </VCardSubtitle>
      </VCardItem>
      <VCardText>
        <VTextField
          v-model="search"
          label="Recherche"
          placeholder="Préfixe ou opérateur"
          prepend-inner-icon="ri-search-line"
          clearable
          autocomplete="off"
          class="search-field"
        />
      </VCardText>

      <VDivider />

      <AppErrorState
        v-if="error && data === null"
        class="ma-4"
        :error="error"
        @retry="reload"
      />

      <VSkeletonLoader
        v-else-if="data === null || loading && data === null"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="filtered.length === 0"
        icon="ri-sim-card-line"
        :title="search.trim() ? 'Aucun préfixe ne correspond' : 'Aucun préfixe enregistré'"
        :text="search.trim() ? 'Essayez une autre recherche.' : 'Ajoutez le premier préfixe d\'opérateur.'"
      >
        <VBtn
          v-if="!search.trim()"
          @click="create"
        >
          Nouveau préfixe
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable hover>
          <thead>
            <tr>
              <th>Préfixe</th>
              <th>Opérateur</th>
              <th class="d-none d-md-table-cell">
                Code
              </th>
              <th class="d-none d-md-table-cell">
                Modifié le
              </th>
              <th>Actif</th>
              <th
                class="text-end"
                aria-label="Actions"
              />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in rows"
              :key="item.id"
              class="cursor-pointer"
              tabindex="0"
              @click="edit(item)"
              @keydown.enter="edit(item)"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    :color="item.is_active ? 'primary' : 'secondary'"
                    variant="tonal"
                    rounded
                    size="38"
                  >
                    <VIcon icon="ri-sim-card-line" />
                  </VAvatar>
                  <div>
                    <div class="text-body-1 font-weight-medium text-high-emphasis tabular-nums">
                      {{ item.country_code }} {{ item.national_prefix }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      Numéros commençant par {{ item.national_prefix }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="text-high-emphasis">
                {{ item.operator_name }}
              </td>
              <td class="d-none d-md-table-cell">
                <AppStatusChip
                  :label="item.operator_code"
                  tone="info"
                />
              </td>
              <td class="d-none d-md-table-cell text-medium-emphasis text-no-wrap">
                {{ formatDate(item.updated_at) }}
              </td>
              <td
                @click.stop
                @keydown.enter.stop
              >
                <VSwitch
                  :model-value="item.is_active"
                  color="primary"
                  hide-details
                  density="compact"
                  :disabled="busyId === item.id"
                  :aria-label="`Préfixe ${item.national_prefix} actif`"
                  @update:model-value="toggle.submit(item)"
                />
              </td>
              <td
                class="text-end"
                @click.stop
                @keydown.enter.stop
              >
                <IconBtn
                  :aria-label="`Modifier le préfixe ${item.national_prefix}`"
                  @click="edit(item)"
                >
                  <VIcon icon="ri-edit-line" />
                </IconBtn>
              </td>
            </tr>
          </tbody>
        </VTable>

        <VDivider />

        <AppTablePagination
          :page="page"
          :page-size="pageSize"
          :count="rows.length"
          :total="total"
          :pages="pages"
          :has-next="hasNext"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </template>
    </VCard>

    <PrefixFormDialog
      v-model="dialog"
      :prefix="edited"
      @saved="refresh"
    />
  </div>
</template>

<style scoped>
.search-field {
  max-inline-size: 24rem;
}
</style>
