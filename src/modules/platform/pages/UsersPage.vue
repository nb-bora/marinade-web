<script setup lang="ts">
import { platformApi } from '../api'
import UserFormDialog from '../components/UserFormDialog.vue'
import { ROLE_OPTIONS, initialsOf, roleColor, roleLabel } from '../labels'
import type { PlatformUser } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { useConfirm } from '@/composables/useConfirm'
import { formatDate } from '@/lib/format'
import { useSessionStore } from '@/stores/session.store'
import { useToast } from '@/stores/toast.store'
import type { StatStripItem } from '@/ui/AppStatStrip.vue'

const session = useSessionStore()
const toast = useToast()
const confirm = useConfirm()

const { data, loading, error, reload, refresh } = useAsyncData(signal => platformApi.users(signal))
const users = computed(() => data.value ?? [])

// Filtres
const role = ref<string | null>(null)
const status = ref<'active' | 'inactive' | null>(null)
const search = ref('')
const searchDebounced = refDebounced(search, 250)

const roleItems = [...ROLE_OPTIONS, { value: 'delivery', title: 'Livreur' }]

const statusItems = [
  { value: 'active', title: 'Actifs' },
  { value: 'inactive', title: 'Désactivés' },
]

const filtered = computed(() => {
  const needle = searchDebounced.value.trim().toLowerCase()

  return users.value
    .filter(user => !role.value || user.role === role.value)
    .filter(user => !status.value || user.is_active === (status.value === 'active'))
    .filter(user => !needle || `${user.first_name} ${user.last_name} ${user.email} ${user.phone}`.toLowerCase().includes(needle))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
})

const hasFilters = computed(() => role.value !== null || status.value !== null || search.value.trim() !== '')
const { page, pageSize, total, pages, rows, hasNext } = useClientPagination(filtered, 10)

function clearFilters() {
  role.value = null
  status.value = null
  search.value = ''
}

// Bandeau
const TEAM_ROLES = ['manager', 'cashier', 'waiter', 'chef', 'pos', 'delivery']

const strip = computed<StatStripItem[]>(() => {
  const all = users.value
  const count = (predicate: (user: PlatformUser) => boolean) => all.filter(predicate).length
  const active = count(user => user.is_active)
  const admins = count(user => user.role === 'admin')

  return [
    { label: 'Utilisateurs', value: String(all.length), icon: 'ri-group-line', hint: `dont ${admins} administrateur${admins > 1 ? 's' : ''}` },
    { label: 'Comptes actifs', value: String(active), icon: 'ri-user-follow-line', hint: `${all.length - active} désactivé${all.length - active > 1 ? 's' : ''}` },
    { label: 'Propriétaires', value: String(count(user => user.role === 'restaurant')), icon: 'ri-store-2-line', hint: 'Responsables de restaurant' },
    { label: 'Équipes', value: String(count(user => TEAM_ROLES.includes(user.role))), icon: 'ri-team-line', hint: 'Gérants, caisse, salle et cuisine' },
  ]
})

// Actions
const dialog = ref(false)
const edited = ref<PlatformUser | null>(null)
const busyId = ref<string | null>(null)

function create() {
  edited.value = null
  dialog.value = true
}

function edit(user: PlatformUser) {
  edited.value = user
  dialog.value = true
}

const isSelf = (user: PlatformUser) => user.id === session.user?.id

async function toggleActive(user: PlatformUser) {
  const accepted = await confirm({
    title: `${user.is_active ? 'Désactiver' : 'Réactiver'} ${user.first_name} ${user.last_name} ?`,
    text: user.is_active
      ? 'Cette personne ne pourra plus se connecter. Vous pourrez réactiver le compte à tout moment.'
      : 'Cette personne pourra de nouveau se connecter.',
    confirmLabel: user.is_active ? 'Supprimer' : 'Enregistrer',
    danger: user.is_active,
  })

  if (accepted) {
    busyId.value = user.id
    try {
      await platformApi.updateUser(user.id, { is_active: !user.is_active })
      toast.success(user.is_active ? 'Compte désactivé.' : 'Compte réactivé.')
      await refresh()
    }
    catch (cause) {
      toast.error(cause)
    }
    finally {
      busyId.value = null
    }
  }
}

async function remove(user: PlatformUser) {
  const accepted = await confirm({
    title: `Supprimer ${user.first_name} ${user.last_name} ?`,
    text: 'Le compte est supprimé définitivement. Pour simplement bloquer l\'accès, désactivez-le plutôt.',
    confirmLabel: 'Supprimer',
    danger: true,
  })

  if (!accepted)
    return

  busyId.value = user.id
  try {
    await platformApi.deleteUser(user.id)
    toast.success('Utilisateur supprimé.')
    await refresh()
  }
  catch (cause) {
    toast.error(cause)
  }
  finally {
    busyId.value = null
  }
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Utilisateurs"
      subtitle="Tous les comptes de la plateforme : propriétaires, équipes et administrateurs."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          color="secondary"
          prepend-icon="ri-refresh-line"
          :loading="loading"
          @click="reload"
        >
          Actualiser
        </VBtn>
        <VBtn
          prepend-icon="ri-user-add-line"
          @click="create"
        >
          Nouvel utilisateur
        </VBtn>
      </template>
    </AppPageHeader>

    <AppStatStrip
      :items="strip"
      :loading="loading && data === null"
    />

    <VCard class="mt-6">
      <VCardItem class="pb-2">
        <VCardTitle>Filtres</VCardTitle>
      </VCardItem>
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="4"
          >
            <VSelect
              v-model="role"
              :items="roleItems"
              label="Rôle"
              prepend-inner-icon="ri-shield-user-line"
              placeholder="Tous les rôles"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            md="4"
          >
            <VSelect
              v-model="status"
              :items="statusItems"
              label="Statut"
              prepend-inner-icon="ri-list-check"
              placeholder="Tous les statuts"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            md="4"
          >
            <VTextField
              v-model="search"
              label="Recherche"
              placeholder="Nom, e-mail ou téléphone"
              prepend-inner-icon="ri-search-line"
              clearable
              autocomplete="off"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <AppErrorState
        v-if="error && data === null"
        class="ma-4"
        :error="error"
        @retry="reload"
      />

      <VSkeletonLoader
        v-else-if="data === null"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="filtered.length === 0"
        icon="ri-user-search-line"
        :title="hasFilters ? 'Aucun utilisateur ne correspond' : 'Aucun utilisateur'"
        :text="hasFilters ? 'Essayez d\'autres filtres.' : 'Créez le premier compte pour commencer.'"
      >
        <VBtn
          v-if="hasFilters"
          variant="outlined"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
        <VBtn
          v-else
          @click="create"
        >
          Nouvel utilisateur
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable hover>
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th class="d-none d-md-table-cell">
                Rôle
              </th>
              <th>Statut</th>
              <th class="d-none d-md-table-cell">
                E-mail vérifié
              </th>
              <th class="d-none d-md-table-cell">
                Double authentification
              </th>
              <th class="d-none d-lg-table-cell">
                Créé le
              </th>
              <th
                class="text-end"
                aria-label="Actions"
              />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in rows"
              :key="user.id"
              class="cursor-pointer"
              tabindex="0"
              @click="edit(user)"
              @keydown.enter="edit(user)"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    :color="roleColor(user.role)"
                    variant="tonal"
                    rounded
                    size="38"
                  >
                    <span class="text-body-1 font-weight-medium">{{ initialsOf(user.first_name, user.last_name) }}</span>
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate user-cell">
                      {{ user.first_name }} {{ user.last_name }}
                      <span
                        v-if="isSelf(user)"
                        class="text-medium-emphasis"
                      >(vous)</span>
                    </div>
                    <div class="text-body-2 text-medium-emphasis text-truncate user-cell">
                      {{ user.email }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis d-md-none">
                      {{ roleLabel(user.role) }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="d-none d-md-table-cell">
                <span class="text-body-1 text-high-emphasis text-no-wrap">{{ roleLabel(user.role) }}</span>
              </td>
              <td>
                <AppStatusChip
                  :label="user.is_active ? 'Actif' : 'Désactivé'"
                  :tone="user.is_active ? 'success' : 'neutral'"
                />
              </td>
              <td class="d-none d-md-table-cell">
                <AppStatusChip
                  :label="user.email_verified_at ? 'Vérifié' : 'Non vérifié'"
                  :tone="user.email_verified_at ? 'success' : 'warning'"
                  :icon="user.email_verified_at ? 'ri-mail-check-line' : 'ri-mail-line'"
                />
              </td>
              <td class="d-none d-md-table-cell">
                <AppStatusChip
                  :label="user.two_factor_enabled ? 'Activée' : 'Désactivée'"
                  :tone="user.two_factor_enabled ? 'success' : 'neutral'"
                  :icon="user.two_factor_enabled ? 'ri-shield-check-line' : 'ri-shield-line'"
                />
              </td>
              <td class="d-none d-lg-table-cell text-medium-emphasis text-no-wrap">
                {{ formatDate(user.created_at) }}
              </td>
              <td
                class="text-end"
                @click.stop
                @keydown.enter.stop
              >
                <IconBtn
                  :aria-label="`Actions pour ${user.first_name} ${user.last_name}`"
                  :disabled="busyId === user.id"
                >
                  <VIcon icon="ri-more-2-fill" />
                  <VMenu activator="parent">
                    <VList density="compact">
                      <VListItem
                        prepend-icon="ri-edit-line"
                        title="Modifier"
                        @click="edit(user)"
                      />
                      <VListItem
                        :prepend-icon="user.is_active ? 'ri-user-forbid-line' : 'ri-user-follow-line'"
                        :title="user.is_active ? 'Désactiver' : 'Réactiver'"
                        :disabled="isSelf(user)"
                        @click="toggleActive(user)"
                      />
                      <VListItem
                        prepend-icon="ri-delete-bin-line"
                        title="Supprimer"
                        base-color="error"
                        :disabled="isSelf(user)"
                        @click="remove(user)"
                      />
                    </VList>
                  </VMenu>
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

    <UserFormDialog
      v-model="dialog"
      :user="edited"
      @saved="refresh"
    />
  </div>
</template>

<style scoped>
.user-cell {
  max-inline-size: 10rem;
}

@media (min-width: 960px) {
  .user-cell {
    max-inline-size: 16rem;
  }
}
</style>
