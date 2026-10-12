<!--
  Clients du pressing, retrouvés à partir de leurs commandes (le serveur les regroupe par téléphone,
  sinon par nom ; les commandes annulées ne comptent pas). Recherche par nom ou téléphone,
  pagination par le serveur (sans total : on demande une ligne de plus pour savoir s'il reste une
  page). Un clic ouvre les commandes du client. Aucune création de client : il naît avec sa
  première commande.
-->
<script setup lang="ts">
import { pressingApi } from '../api'
import { avatarColor, formatPhone, initials } from '../labels'
import type { Client } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { formatDateTime, formatRelative } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const route = useRoute()
const router = useRouter()

const canRead = computed(() => tenant.can('front_of_house'))

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const searchDebounced = refDebounced(search, 300)
const page = ref(1)
const pageSize = ref(10)

async function fetchPage(signal: AbortSignal): Promise<Client[]> {
  if (!tenant.currentId || !canRead.value)
    return []

  return pressingApi.clientsPage(tenant.currentId, {
    q: searchDebounced.value,
    skip: (page.value - 1) * pageSize.value,
    limit: pageSize.value + 1,
  }, signal)
}

const list = useAsyncData(fetchPage, { watch: [searchDebounced, page, pageSize, () => tenant.currentId] })

watch([searchDebounced, pageSize], () => {
  page.value = 1
})

const received = computed(() => list.data.value ?? [])
const rows = computed(() => received.value.slice(0, pageSize.value))
const hasNext = computed(() => received.value.length > pageSize.value)
const loaded = computed(() => list.data.value !== null)
const hasSearch = computed(() => search.value.trim() !== '')

// Les dates relatives (« il y a 3 heures ») avancent sans nouvelle requête.
const now = ref(new Date())

useIntervalFn(() => {
  now.value = new Date()
}, 60_000)

/** Les commandes du client : recherche par téléphone (plus sûr), sinon par nom, tous statuts. */
const ordersLink = (client: Client) => ({ path: '/pressing/commandes', query: { onglet: 'toutes', q: client.telephone || client.nom } })

const open = (client: Client) => router.push(ordersLink(client))

const rowKey = (client: Client) => `${client.telephone ?? ''}|${client.nom}`
</script>

<template>
  <div>
    <AppPageHeader
      title="Clients"
      subtitle="Vos clients, ce qu'ils ont commandé et ce qu'il leur reste à payer."
    >
      <template
        v-if="canRead"
        #actions
      >
        <VBtn
          prepend-icon="ri-add-line"
          to="/pressing/commandes/nouvelle"
        >
          Nouvelle commande
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard v-if="!canRead">
      <AppEmptyState
        icon="ri-lock-line"
        title="Les clients ne sont pas disponibles pour votre rôle"
        text="Demandez au responsable du pressing de vous donner accès à la salle."
      />
    </VCard>

    <VCard v-else>
      <VCardItem>
        <VCardTitle>Liste des clients</VCardTitle>
        <VCardSubtitle class="text-wrap">
          Un client par numéro de téléphone (ou par nom, sans téléphone), du plus récent au plus ancien.
        </VCardSubtitle>
      </VCardItem>

      <VCardText>
        <VTextField
          v-model="search"
          label="Rechercher"
          placeholder="Nom ou téléphone"
          prepend-inner-icon="ri-search-line"
          clearable
          hide-details
          autocomplete="off"
          class="search"
          data-tour="clients-search"
          data-testid="clients-search"
        />
      </VCardText>

      <VDivider />

      <AppErrorState
        v-if="list.error.value && !loaded"
        class="ma-4"
        :error="list.error.value"
        @retry="list.reload"
      />

      <VSkeletonLoader
        v-else-if="!loaded"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="rows.length === 0 && hasSearch"
        icon="ri-user-search-line"
        title="Aucun client trouvé"
        :text="`Aucun client ne correspond à « ${search.trim()} ». Cherchez par nom ou par numéro de téléphone.`"
      >
        <VBtn
          variant="outlined"
          @click="search = ''"
        >
          Effacer la recherche
        </VBtn>
      </AppEmptyState>

      <AppEmptyState
        v-else-if="rows.length === 0 && page > 1"
        icon="ri-group-line"
        title="Plus de client sur cette page"
        text="La liste a changé depuis votre dernier chargement."
      >
        <VBtn
          variant="outlined"
          @click="page = 1"
        >
          Revenir à la première page
        </VBtn>
      </AppEmptyState>

      <AppEmptyState
        v-else-if="rows.length === 0"
        icon="ri-group-line"
        title="Aucun client pour l'instant"
        text="Les clients apparaissent dès leur première commande."
      >
        <VBtn
          prepend-icon="ri-add-line"
          to="/pressing/commandes/nouvelle"
        >
          Nouvelle commande
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <div
          :class="{ 'is-refreshing': list.loading.value }"
          data-tour="clients-list"
        >
          <VTable
            hover
            class="d-none d-md-block"
            data-testid="clients-table"
          >
            <thead>
              <tr>
                <th>Client</th>
                <th>Téléphone</th>
                <th class="text-end">
                  Commandes
                </th>
                <th class="text-end">
                  Total dépensé
                </th>
                <th class="text-end">
                  Reste à payer
                </th>
                <th class="d-none d-lg-table-cell">
                  Dernière commande
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="client in rows"
                :key="rowKey(client)"
                class="cursor-pointer"
                tabindex="0"
                :aria-label="`Voir les commandes de ${client.nom}`"
                @click="open(client)"
                @keydown.enter="open(client)"
              >
                <td>
                  <div class="d-flex align-center gap-3 py-2">
                    <VAvatar
                      :color="avatarColor(client.telephone || client.nom)"
                      variant="tonal"
                      rounded
                      size="38"
                    >
                      <span class="text-body-2 font-weight-semibold">{{ initials(client.nom) }}</span>
                    </VAvatar>
                    <div class="min-w-0">
                      <div class="text-body-1 font-weight-medium text-high-emphasis name-cell">
                        {{ client.nom }}
                      </div>
                      <div class="text-body-2 text-medium-emphasis d-lg-none text-no-wrap">
                        {{ formatRelative(client.derniere_commande, now) }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="text-no-wrap tabular-nums">
                  <span v-if="client.telephone">{{ formatPhone(client.telephone) }}</span>
                  <span
                    v-else
                    class="text-disabled"
                  >Sans téléphone</span>
                </td>
                <td class="text-end tabular-nums">
                  {{ client.nb_commandes }}
                </td>
                <td class="text-end font-weight-semibold text-high-emphasis">
                  <AppMoney :amount="client.total_depense" />
                </td>
                <td class="text-end">
                  <span
                    v-if="client.reste_a_payer > 0"
                    class="text-warning font-weight-semibold"
                  ><AppMoney :amount="client.reste_a_payer" /></span>
                  <span
                    v-else
                    class="text-success text-body-2"
                  >Soldé</span>
                </td>
                <td
                  class="d-none d-lg-table-cell text-no-wrap"
                  :title="formatDateTime(client.derniere_commande)"
                >
                  {{ formatRelative(client.derniere_commande, now) }}
                </td>
              </tr>
            </tbody>
          </VTable>

          <div class="d-md-none pa-4 d-flex flex-column gap-3">
            <RouterLink
              v-for="client in rows"
              :key="rowKey(client)"
              :to="ordersLink(client)"
              class="client-card pa-4"
            >
              <div class="d-flex align-center gap-3">
                <VAvatar
                  :color="avatarColor(client.telephone || client.nom)"
                  variant="tonal"
                  rounded
                  size="40"
                >
                  <span class="text-body-2 font-weight-semibold">{{ initials(client.nom) }}</span>
                </VAvatar>
                <div class="min-w-0 flex-grow-1">
                  <div class="text-subtitle-1 font-weight-semibold text-high-emphasis text-truncate">
                    {{ client.nom }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis text-truncate">
                    {{ client.telephone ? formatPhone(client.telephone) : 'Sans téléphone' }}
                  </div>
                </div>
                <VIcon
                  icon="ri-arrow-right-s-line"
                  class="text-medium-emphasis"
                />
              </div>
              <div class="client-card__facts mt-3">
                <div>
                  <div class="text-caption text-medium-emphasis">
                    Commandes
                  </div>
                  <div class="text-body-1 font-weight-medium tabular-nums">
                    {{ client.nb_commandes }}
                  </div>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">
                    Total dépensé
                  </div>
                  <div class="text-body-1 font-weight-medium">
                    <AppMoney :amount="client.total_depense" />
                  </div>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">
                    Reste à payer
                  </div>
                  <div
                    class="text-body-1 font-weight-medium"
                    :class="client.reste_a_payer > 0 ? 'text-warning' : 'text-success'"
                  >
                    <AppMoney
                      v-if="client.reste_a_payer > 0"
                      :amount="client.reste_a_payer"
                    />
                    <template v-else>
                      Soldé
                    </template>
                  </div>
                </div>
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                Dernière commande {{ formatRelative(client.derniere_commande, now) }}
              </div>
            </RouterLink>
          </div>
        </div>

        <VDivider />

        <AppTablePagination
          :page="page"
          :page-size="pageSize"
          :count="rows.length"
          :pages="hasNext ? page + 1 : page"
          :has-next="hasNext"
          :loading="list.loading.value"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </template>
    </VCard>
  </div>
</template>

<style scoped>
.search {
  max-inline-size: 26rem;
}

.name-cell {
  overflow: hidden;
  max-inline-size: 16rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-refreshing {
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.client-card {
  display: block;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 14px;
  color: inherit;
  text-decoration: none;
}

.client-card:hover,
.client-card:focus-visible {
  border-color: rgb(var(--v-theme-primary));
}

.client-card__facts {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
</style>
