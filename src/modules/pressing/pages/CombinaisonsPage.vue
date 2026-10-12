<script setup lang="ts">
import { pressingApi } from '../api'
import CombinaisonFormDialog from '../components/CombinaisonFormDialog.vue'
import { combinaisonsImport } from '../imports'
import { normalize, pressingError } from '../labels'
import type { Combinaison } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const DEACTIVATE = (combo: Combinaison) => ({
  title: 'Désactiver cette combinaison ?',
  text: `« ${combo.nom} » ne sera plus proposée au calculateur. Vous pourrez la réactiver plus tard.`,
  confirmLabel: 'Désactiver',
  danger: true,
})

const REACTIVATE = (combo: Combinaison) => ({
  title: 'Réactiver cette combinaison ?',
  text: `« ${combo.nom} » sera de nouveau proposée au calculateur.`,
  confirmLabel: 'Réactiver',
})

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()
const canWrite = computed(() => tenant.can('management'))
const importDialog = ref(false)
const importDefinition = combinaisonsImport()

const combos = useAsyncData(
  signal => tenant.currentId ? pressingApi.combinaisons(tenant.currentId, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

// Tous les articles, y compris désactivés : une combinaison peut en contenir.
const articles = useAsyncData(
  signal => tenant.currentId ? pressingApi.articles(tenant.currentId, undefined, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

const list = computed(() => combos.data.value ?? [])
const loadedOnce = computed(() => combos.data.value !== null)

const search = ref('')
const searchDebounced = refDebounced(search, 250)
const status = ref<'actives' | 'inactives' | 'toutes'>('actives')

const statusItems = [
  { value: 'actives', title: 'Actives' },
  { value: 'inactives', title: 'Inactives' },
  { value: 'toutes', title: 'Toutes' },
]

const hasFilters = computed(() => search.value.trim() !== '' || status.value !== 'actives')

const filtered = computed(() => {
  const term = normalize(searchDebounced.value.trim())

  return list.value
    .filter(combo => {
      if (term && !normalize(`${combo.nom} ${combo.lignes.map(ligne => ligne.article_nom).join(' ')}`).includes(term))
        return false
      if (status.value === 'actives' && !combo.actif)
        return false

      return !(status.value === 'inactives' && combo.actif)
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})

function clearFilters() {
  search.value = ''
  status.value = 'actives'
}

const saving = (combo: Combinaison) => combo.total_articles - combo.prix

// Formulaire
const formOpen = ref(false)
const edited = ref<Combinaison | null>(null)

function newCombo() {
  edited.value = null
  formOpen.value = true
}

function editCombo(combo: Combinaison) {
  edited.value = combo
  formOpen.value = true
}

// Désactivation et réactivation
const busyId = ref<string | null>(null)

const { submit: toggle, error: toggleError } = useSubmit(async (combo: Combinaison) => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return

  const accepted = await confirm(combo.actif ? DEACTIVATE(combo) : REACTIVATE(combo))

  if (!accepted)
    return

  busyId.value = combo.id
  try {
    if (combo.actif) {
      await pressingApi.deactivateCombinaison(restaurantId, combo.id)
      toast.success(`« ${combo.nom} » est désactivée.`)
    }
    else {
      await pressingApi.updateCombinaison(restaurantId, combo.id, {
        nom: combo.nom,
        prix: combo.prix,
        lignes: combo.lignes.map(ligne => ({ article_id: ligne.article_id, quantite: ligne.quantite })),
        actif: true,
      })
      toast.success(`« ${combo.nom} » est de nouveau active.`)
    }

    await combos.refresh()
  }
  finally {
    busyId.value = null
  }
})

watch(toggleError, value => {
  if (value)
    toast.error(pressingError(value))
})

const refreshAll = () => Promise.all([combos.refresh(), articles.refresh()])
</script>

<template>
  <div>
    <AppPageHeader
      title="Combinaisons du pressing"
      subtitle="Vos ensembles d'articles vendus à prix fixe, par exemple « drap + taie »."
    >
      <template
        v-if="canWrite"
        #actions
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          data-testid="combos-import"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
        <VBtn
          prepend-icon="ri-add-line"
          data-testid="combos-add"
          @click="newCombo"
        >
          Créer une combinaison
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard class="mb-6">
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="8"
          >
            <VTextField
              v-model="search"
              label="Rechercher"
              placeholder="Nom de la combinaison ou d'un article"
              prepend-inner-icon="ri-search-line"
              clearable
              autocomplete="off"
              hide-details
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
              prepend-inner-icon="ri-filter-3-line"
              hide-details
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <AppErrorState
      v-if="combos.error.value && !loadedOnce"
      :error="combos.error.value"
      @retry="combos.reload"
    />

    <VRow v-else-if="!loadedOnce">
      <VCol
        v-for="n in 3"
        :key="n"
        cols="12"
        md="6"
        xl="4"
      >
        <VSkeletonLoader type="article" />
      </VCol>
    </VRow>

    <VCard v-else-if="filtered.length === 0">
      <AppEmptyState
        icon="ri-stack-line"
        :title="hasFilters ? 'Aucune combinaison ne correspond' : 'Aucune combinaison pour l\'instant'"
        :text="hasFilters
          ? 'Essayez d\'autres filtres ou une autre recherche.'
          : canWrite ? 'Composez un ensemble d\'articles à prix fixe, ou importez vos combinaisons depuis Excel.' : 'La direction n\'a pas encore créé de combinaison.'"
      >
        <VBtn
          v-if="hasFilters"
          variant="outlined"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
        <div
          v-else-if="canWrite"
          class="d-flex flex-wrap justify-center gap-3"
        >
          <VBtn
            prepend-icon="ri-add-line"
            @click="newCombo"
          >
            Créer une combinaison
          </VBtn>
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-upload-2-line"
            @click="importDialog = true"
          >
            Importer depuis Excel
          </VBtn>
        </div>
      </AppEmptyState>
    </VCard>

    <VRow
      v-else
      data-testid="combos-list"
    >
      <VCol
        v-for="combo in filtered"
        :key="combo.id"
        cols="12"
        md="6"
        xl="4"
      >
        <VCard
          class="h-100 d-flex flex-column"
          :class="{ 'opacity-60': !combo.actif }"
          :data-testid="`combo-${combo.nom}`"
        >
          <VCardItem>
            <template #prepend>
              <VAvatar
                color="primary"
                variant="tonal"
                rounded
              >
                <VIcon icon="ri-stack-line" />
              </VAvatar>
            </template>
            <VCardTitle class="text-wrap">
              {{ combo.nom }}
            </VCardTitle>
            <template #append>
              <VMenu v-if="canWrite">
                <template #activator="{ props: menuProps }">
                  <IconBtn
                    v-bind="menuProps"
                    :aria-label="`Actions pour ${combo.nom}`"
                    :disabled="busyId === combo.id"
                  >
                    <VIcon icon="ri-more-2-fill" />
                  </IconBtn>
                </template>
                <VList>
                  <VListItem
                    prepend-icon="ri-pencil-line"
                    title="Modifier"
                    @click="editCombo(combo)"
                  />
                  <VListItem
                    :prepend-icon="combo.actif ? 'ri-forbid-line' : 'ri-checkbox-circle-line'"
                    :title="combo.actif ? 'Désactiver' : 'Réactiver'"
                    @click="toggle(combo)"
                  />
                </VList>
              </VMenu>
            </template>
          </VCardItem>

          <VCardText class="flex-grow-1">
            <ul class="combo-lines text-body-1 mb-4">
              <li
                v-for="ligne in combo.lignes"
                :key="ligne.article_id"
              >
                <strong>{{ ligne.quantite }} ×</strong> {{ ligne.article_nom }}
              </li>
            </ul>

            <div class="d-flex flex-wrap align-center gap-2">
              <span class="text-h5 font-weight-bold text-primary tabular-nums">{{ formatMoney(combo.prix, 'XAF') }}</span>
              <AppStatusChip
                :label="combo.actif ? 'Active' : 'Inactive'"
                :tone="combo.actif ? 'success' : 'neutral'"
              />
            </div>
            <div class="text-body-2 text-medium-emphasis mt-1">
              Valeur séparée : {{ formatMoney(combo.total_articles, 'XAF') }}
            </div>
            <div
              v-if="saving(combo) > 0"
              class="text-body-2 font-weight-medium text-success mt-1"
            >
              Économie de {{ formatMoney(saving(combo), 'XAF') }} pour le client
            </div>
            <div
              v-else-if="saving(combo) < 0"
              class="text-body-2 font-weight-medium text-warning mt-1"
            >
              Majoration de {{ formatMoney(-saving(combo), 'XAF') }} par rapport à la vente séparée
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <CombinaisonFormDialog
      v-model="formOpen"
      :combinaison="edited"
      :articles="articles.data.value ?? []"
      @saved="refreshAll"
    />

    <AppImportDialog
      v-if="canWrite"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="refreshAll"
    />
  </div>
</template>

<style scoped>
.combo-lines {
  padding-inline-start: 1.25rem;
}
</style>
