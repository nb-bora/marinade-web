<!--
  Liste des commandes du pressing : onglets par étape, recherche (numéro, client, téléphone),
  tableau sur ordinateur, cartes sur téléphone, pagination par le serveur.
-->
<script setup lang="ts">
import { pressingApi } from '../api'
import { COMMANDE_TABS, ETAPE_LABELS, LIVE_INTERVAL_MS, STATUT_INFO } from '../commandes'
import CommandeStatusChip from '../components/CommandeStatusChip.vue'
import { formatKg } from '../labels'
import type { Commande, CommandeListe } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useLive } from '@/composables/useLive'
import { formatDateTime } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const route = useRoute()
const router = useRouter()

const canRead = computed(() => tenant.can('front_of_house'))

const initialTab = typeof route.query.onglet === 'string' && COMMANDE_TABS.some(tab => tab.value === route.query.onglet) ? route.query.onglet : 'en_cours'

const tab = ref(initialTab)
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const searchDebounced = refDebounced(search, 300)
const page = ref(1)
const pageSize = ref(10)

const tabItems = COMMANDE_TABS.map(item => ({ value: item.value, title: item.title }))
const currentTab = computed(() => COMMANDE_TABS.find(item => item.value === tab.value) ?? COMMANDE_TABS[0])

// Le serveur ne filtre que sur un statut : un onglet qui en réunit plusieurs interroge chacun
// d'eux et fusionne, du plus récent au plus ancien. Seules les commandes jusqu'à la page courante
// sont demandées à chaque statut : la fusion reste exacte et le rafraîchissement reste léger.

async function fetchPage(signal: AbortSignal): Promise<CommandeListe> {
  if (!tenant.currentId || !canRead.value)
    return { items: [], total: 0 }

  const restaurantId = tenant.currentId
  const q = searchDebounced.value.trim()
  const { statuts } = currentTab.value

  if (statuts.length <= 1) {
    return pressingApi.commandes(restaurantId, {
      statut: statuts[0],
      q,
      skip: (page.value - 1) * pageSize.value,
      limit: pageSize.value,
    }, signal)
  }

  const reach = page.value * pageSize.value
  const parts = await Promise.all(statuts.map(statut => pressingApi.commandes(restaurantId, { statut, q, skip: 0, limit: reach }, signal)))
  const merged = parts.flatMap(part => part.items).sort((a, b) => b.cree_le.localeCompare(a.cree_le))

  return { items: merged.slice((page.value - 1) * pageSize.value, reach), total: parts.reduce((sum, part) => sum + part.total, 0) }
}

const list = useAsyncData(fetchPage, { watch: [tab, searchDebounced, page, pageSize, () => tenant.currentId] })

watch([tab, searchDebounced, pageSize], () => {
  page.value = 1
})

useLive(list.refresh, LIVE_INTERVAL_MS)

const rows = computed<Commande[]>(() => list.data.value?.items ?? [])
const total = computed(() => list.data.value?.total ?? 0)
const loaded = computed(() => list.data.value !== null)
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const hasFilters = computed(() => search.value.trim() !== '')

const open = (commande: Commande) => router.push(`/pressing/commandes/${commande.id}`)

function servicesOf(commande: Commande): string[] {
  const parts: string[] = []

  if (commande.lavage)
    parts.push('Lavage')
  if (commande.sechage)
    parts.push('Séchage')

  const articles = commande.lignes.filter(ligne => ligne.type === 'article').reduce((sum, ligne) => sum + Number(ligne.quantite), 0)
  const combos = commande.lignes.filter(ligne => ligne.type === 'combinaison').reduce((sum, ligne) => sum + Number(ligne.quantite), 0)

  if (articles)
    parts.push(`${articles} article${articles > 1 ? 's' : ''}`)
  if (combos)
    parts.push(`${combos} combinaison${combos > 1 ? 's' : ''}`)

  return parts
}

const emptyText = computed(() => {
  if (hasFilters.value)
    return 'Aucune commande ne correspond à cette recherche dans cet onglet. Essayez le numéro, le nom ou le téléphone du client, ou l\'onglet « Toutes ».'

  return {
    a_prendre: 'Toutes les commandes reçues ont été prises en charge.',
    en_cours: 'Aucune commande n\'est en attente de machine, en lavage ou en séchage.',
    pretes: 'Aucune commande n\'est prête à être remise.',
    livrees: 'Aucune commande n\'a encore été livrée.',
    toutes: 'Les commandes enregistrées apparaîtront ici.',
  }[tab.value] ?? ''
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Commandes"
      subtitle="Suivez chaque commande, de la réception du linge à sa remise au client."
    >
      <template
        v-if="canRead"
        #actions
      >
        <VBtn
          prepend-icon="ri-add-line"
          to="/pressing/commandes/nouvelle"
          data-tour="orders-new"
        >
          Nouvelle commande
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard v-if="!canRead">
      <AppEmptyState
        icon="ri-lock-line"
        title="Les commandes ne sont pas disponibles pour votre rôle"
        text="Demandez au responsable du pressing de vous donner accès à la salle."
      />
    </VCard>

    <VCard v-else>
      <VCardItem>
        <VCardTitle>Liste des commandes</VCardTitle>
        <template #append>
          <span
            v-if="loaded"
            class="text-body-2 text-medium-emphasis"
          >{{ total }} commande{{ total > 1 ? 's' : '' }}</span>
        </template>
      </VCardItem>

      <VCardText class="d-flex flex-wrap align-center gap-4">
        <div
          class="tabs-scroll"
          data-tour="orders-tabs"
        >
          <AppSegmented
            v-model="tab"
            :options="tabItems"
            label="Étape des commandes"
          />
        </div>
        <VTextField
          v-model="search"
          label="Rechercher"
          placeholder="Numéro, client ou téléphone"
          prepend-inner-icon="ri-search-line"
          clearable
          hide-details
          autocomplete="off"
          class="search"
          data-testid="orders-search"
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
        v-else-if="rows.length === 0"
        icon="ri-shopping-basket-2-line"
        :title="hasFilters ? 'Aucune commande trouvée' : 'Aucune commande ici'"
        :text="emptyText"
      >
        <VBtn
          v-if="hasFilters"
          variant="outlined"
          @click="search = ''"
        >
          Effacer la recherche
        </VBtn>
        <VBtn
          v-else
          prepend-icon="ri-add-line"
          to="/pressing/commandes/nouvelle"
        >
          Nouvelle commande
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable
          hover
          class="d-none d-md-block orders-table"
        >
          <thead>
            <tr>
              <th>Commande</th>
              <th>Client</th>
              <th class="text-end">
                Poids
              </th>
              <th class="d-none d-lg-table-cell">
                Services
              </th>
              <th class="text-end">
                Total
              </th>
              <th class="text-end">
                Payé / reste
              </th>
              <th>Statut</th>
              <th class="d-none d-xl-table-cell">
                Étape
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="commande in rows"
              :key="commande.id"
              class="cursor-pointer"
              tabindex="0"
              @click="open(commande)"
              @keydown.enter="open(commande)"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    :color="STATUT_INFO[commande.statut].tone === 'neutral' ? 'secondary' : STATUT_INFO[commande.statut].tone"
                    variant="tonal"
                    rounded
                    size="38"
                  >
                    <VIcon :icon="STATUT_INFO[commande.statut].icon" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis text-no-wrap">
                      {{ commande.numero }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis text-no-wrap">
                      {{ formatDateTime(commande.cree_le) }}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div class="text-body-1 text-high-emphasis client-cell">
                  {{ commande.client_nom }}
                </div>
                <div class="text-body-2 text-medium-emphasis text-no-wrap">
                  {{ commande.client_telephone ?? 'Sans téléphone' }}
                </div>
              </td>
              <td class="text-end text-no-wrap tabular-nums">
                {{ commande.poids_grams ? formatKg(commande.poids_grams) : '—' }}
              </td>
              <td class="d-none d-lg-table-cell">
                <div class="d-flex flex-wrap gap-1">
                  <VChip
                    v-for="service in servicesOf(commande)"
                    :key="service"
                    size="x-small"
                    label
                    variant="tonal"
                  >
                    {{ service }}
                  </VChip>
                </div>
              </td>
              <td class="text-end font-weight-semibold text-high-emphasis">
                <AppMoney :amount="commande.montant_total" />
              </td>
              <td class="text-end">
                <div class="text-body-2 text-medium-emphasis">
                  <AppMoney :amount="commande.montant_paye" />
                </div>
                <div
                  v-if="commande.statut !== 'annulee' && commande.reste_a_payer > 0"
                  class="text-body-2 font-weight-medium text-warning"
                >
                  Reste <AppMoney :amount="commande.reste_a_payer" />
                </div>
                <div
                  v-else-if="commande.statut !== 'annulee'"
                  class="text-body-2 text-success"
                >
                  Soldée
                </div>
              </td>
              <td>
                <CommandeStatusChip :statut="commande.statut" />
              </td>
              <td class="d-none d-xl-table-cell text-no-wrap">
                {{ commande.etape ? ETAPE_LABELS[commande.etape] : '—' }}
              </td>
            </tr>
          </tbody>
        </VTable>

        <div class="d-md-none pa-4 d-flex flex-column gap-3">
          <RouterLink
            v-for="commande in rows"
            :key="commande.id"
            :to="`/pressing/commandes/${commande.id}`"
            class="order-card pa-4"
          >
            <div class="d-flex justify-space-between align-start gap-3">
              <div class="min-w-0">
                <div class="text-subtitle-1 font-weight-semibold text-high-emphasis">
                  {{ commande.numero }}
                </div>
                <div class="text-body-2 text-medium-emphasis text-truncate">
                  {{ commande.client_nom }}<template v-if="commande.client_telephone">
                    · {{ commande.client_telephone }}
                  </template>
                </div>
              </div>
              <CommandeStatusChip :statut="commande.statut" />
            </div>
            <div class="d-flex flex-wrap gap-1 mt-3">
              <VChip
                v-for="service in servicesOf(commande)"
                :key="service"
                size="x-small"
                label
                variant="tonal"
              >
                {{ service }}
              </VChip>
              <VChip
                v-if="commande.poids_grams"
                size="x-small"
                label
                variant="outlined"
              >
                {{ formatKg(commande.poids_grams) }}
              </VChip>
            </div>
            <div class="d-flex justify-space-between align-baseline mt-3">
              <span class="text-body-2 text-medium-emphasis">{{ formatDateTime(commande.cree_le) }}</span>
              <span class="text-end">
                <strong class="text-high-emphasis"><AppMoney :amount="commande.montant_total" /></strong>
                <span
                  v-if="commande.statut !== 'annulee' && commande.reste_a_payer > 0"
                  class="d-block text-body-2 text-warning font-weight-medium"
                >Reste <AppMoney :amount="commande.reste_a_payer" /></span>
              </span>
            </div>
          </RouterLink>
        </div>

        <VDivider />

        <AppTablePagination
          :page="page"
          :page-size="pageSize"
          :count="rows.length"
          :total="total"
          :pages="pages"
          :has-next="page < pages"
          :loading="list.loading.value"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </template>
    </VCard>
  </div>
</template>

<style scoped>
.tabs-scroll {
  max-inline-size: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.search {
  flex: 1 1 16rem;
  max-inline-size: 26rem;
}

.client-cell {
  max-inline-size: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-card {
  display: block;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 14px;
  color: inherit;
  text-decoration: none;
}

.order-card:hover,
.order-card:focus-visible {
  border-color: rgb(var(--v-theme-primary));
}
</style>
