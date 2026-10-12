<script setup lang="ts">
import { useDisplay } from 'vuetify'
import { pressingApi } from '../api'
import ArticleFormDialog from '../components/ArticleFormDialog.vue'
import { articlesImport } from '../imports'
import { normalize, pressingError } from '../labels'
import type { Article } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const NO_CATEGORY = '__none__'

const DEACTIVATE = (article: Article) => ({
  title: 'Désactiver cet article ?',
  text: `« ${article.nom} » ne sera plus proposé au calculateur. Il restera dans les combinaisons existantes.`,
  confirmLabel: 'Désactiver',
  danger: true,
})

const REACTIVATE = (article: Article) => ({
  title: 'Réactiver cet article ?',
  text: `« ${article.nom} » sera de nouveau proposé au calculateur et aux combinaisons.`,
  confirmLabel: 'Réactiver',
})

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()
const { smAndDown } = useDisplay()
const canWrite = computed(() => tenant.can('management'))
const importDialog = ref(false)
const importDefinition = articlesImport()

const { data, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId ? pressingApi.articles(tenant.currentId, undefined, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

const articles = computed(() => data.value ?? [])
const loadedOnce = computed(() => data.value !== null)

const usedCategories = computed(() =>
  [...new Set(articles.value.map(article => article.categorie).filter((value): value is string => !!value))]
    .sort((a, b) => a.localeCompare(b, 'fr')))

// Filtres
const search = ref('')
const searchDebounced = refDebounced(search, 250)
const category = ref<string | null>(null)
const status = ref<'actifs' | 'inactifs' | 'tous'>('actifs')

const hasFilters = computed(() =>
  search.value.trim() !== '' || category.value !== null || status.value !== 'actifs')

const categoryItems = computed(() => [
  { value: NO_CATEGORY, title: 'Sans catégorie' },
  ...usedCategories.value.map(value => ({ value, title: value })),
])

const statusItems = [
  { value: 'actifs', title: 'Actifs' },
  { value: 'inactifs', title: 'Inactifs' },
  { value: 'tous', title: 'Tous' },
]

const filtered = computed(() => {
  const term = normalize(searchDebounced.value.trim())

  return articles.value
    .filter(article => {
      if (term && !normalize(`${article.nom} ${article.categorie ?? ''}`).includes(term))
        return false
      if (category.value === NO_CATEGORY && article.categorie)
        return false
      if (category.value && category.value !== NO_CATEGORY && article.categorie !== category.value)
        return false
      if (status.value === 'actifs' && !article.actif)
        return false

      return !(status.value === 'inactifs' && article.actif)
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})

const pagination = useClientPagination(filtered, 10)

function clearFilters() {
  search.value = ''
  category.value = null
  status.value = 'actifs'
}

// Formulaire
const formOpen = ref(false)
const edited = ref<Article | null>(null)

function newArticle() {
  edited.value = null
  formOpen.value = true
}

function editArticle(article: Article) {
  edited.value = article
  formOpen.value = true
}

// Désactivation et réactivation
const busyId = ref<string | null>(null)

const { submit: toggle, error: toggleError } = useSubmit(async (article: Article) => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return

  const accepted = await confirm(article.actif ? DEACTIVATE(article) : REACTIVATE(article))

  if (!accepted)
    return

  busyId.value = article.id
  try {
    if (article.actif) {
      await pressingApi.deactivateArticle(restaurantId, article.id)
      toast.success(`« ${article.nom} » est désactivé.`)
    }
    else {
      await pressingApi.updateArticle(restaurantId, article.id, {
        nom: article.nom,
        prix_unitaire: article.prix_unitaire,
        categorie: article.categorie,
        actif: true,
      })
      toast.success(`« ${article.nom} » est de nouveau actif.`)
    }

    await refresh()
  }
  finally {
    busyId.value = null
  }
})

watch(toggleError, value => {
  if (value)
    toast.error(pressingError(value))
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Articles du pressing"
      subtitle="Les pièces facturées à l'unité : drap, taie d'oreiller, couette..."
    >
      <template
        v-if="canWrite"
        #actions
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          data-testid="articles-import"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
        <VBtn
          prepend-icon="ri-add-line"
          data-testid="articles-add"
          @click="newArticle"
        >
          Ajouter un article
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
            md="4"
          >
            <VTextField
              v-model="search"
              label="Rechercher"
              placeholder="Nom ou catégorie"
              prepend-inner-icon="ri-search-line"
              clearable
              autocomplete="off"
              data-testid="articles-search"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <VSelect
              v-model="category"
              :items="categoryItems"
              label="Catégorie"
              prepend-inner-icon="ri-folder-line"
              placeholder="Toutes les catégories"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="4"
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

      <div class="d-flex flex-wrap align-center gap-3 px-5 py-4">
        <span class="text-body-1 text-medium-emphasis">
          <template v-if="loadedOnce">
            {{ filtered.length }} article{{ filtered.length > 1 ? 's' : '' }}<template v-if="hasFilters">
              sur {{ articles.length }}
            </template>
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
        icon="ri-t-shirt-line"
        :title="hasFilters ? 'Aucun article ne correspond' : 'Aucun article pour l\'instant'"
        :text="hasFilters
          ? 'Essayez d\'autres filtres ou une autre recherche.'
          : canWrite ? 'Ajoutez vos articles à l\'unité, ou importez-les depuis Excel.' : 'La direction n\'a pas encore ajouté d\'articles.'"
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
            @click="newArticle"
          >
            Ajouter un article
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

      <template v-else>
        <!-- Téléphone : une carte par article -->
        <div
          v-if="smAndDown"
          class="d-flex flex-column gap-3 pa-4"
          data-testid="articles-cards"
        >
          <VCard
            v-for="article in pagination.rows.value"
            :key="article.id"
            variant="outlined"
            :class="{ 'opacity-60': !article.actif }"
          >
            <VCardText class="d-flex align-center gap-3">
              <VAvatar
                color="primary"
                variant="tonal"
                rounded
              >
                <VIcon icon="ri-t-shirt-line" />
              </VAvatar>
              <div class="min-w-0 flex-grow-1">
                <div class="text-body-1 font-weight-medium text-high-emphasis article-name">
                  {{ article.nom }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ article.categorie ?? 'Sans catégorie' }}
                </div>
                <div class="d-flex align-center gap-2 mt-1">
                  <strong><AppMoney :amount="article.prix_unitaire" /></strong>
                  <AppStatusChip
                    :label="article.actif ? 'Actif' : 'Inactif'"
                    :tone="article.actif ? 'success' : 'neutral'"
                  />
                </div>
              </div>
              <VMenu v-if="canWrite">
                <template #activator="{ props: menuProps }">
                  <IconBtn
                    v-bind="menuProps"
                    :aria-label="`Actions pour ${article.nom}`"
                    :disabled="busyId === article.id"
                  >
                    <VIcon icon="ri-more-2-fill" />
                  </IconBtn>
                </template>
                <VList>
                  <VListItem
                    prepend-icon="ri-pencil-line"
                    title="Modifier"
                    @click="editArticle(article)"
                  />
                  <VListItem
                    :prepend-icon="article.actif ? 'ri-forbid-line' : 'ri-checkbox-circle-line'"
                    :title="article.actif ? 'Désactiver' : 'Réactiver'"
                    @click="toggle(article)"
                  />
                </VList>
              </VMenu>
            </VCardText>
          </VCard>
        </div>

        <!-- Ordinateur : tableau -->
        <VTable
          v-else
          hover
          data-testid="articles-table"
        >
          <thead>
            <tr>
              <th>Article</th>
              <th class="text-end">
                Prix unitaire
              </th>
              <th>Statut</th>
              <th
                v-if="canWrite"
                class="text-end"
              >
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="article in pagination.rows.value"
              :key="article.id"
              :class="{ 'cursor-pointer': canWrite }"
              :tabindex="canWrite ? 0 : undefined"
              @click="canWrite && editArticle(article)"
              @keydown.enter="canWrite && editArticle(article)"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    rounded
                    size="38"
                    :class="{ 'opacity-60': !article.actif }"
                  >
                    <VIcon icon="ri-t-shirt-line" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis article-name">
                      {{ article.nom }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ article.categorie ?? 'Sans catégorie' }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="text-end font-weight-semibold text-high-emphasis">
                <AppMoney :amount="article.prix_unitaire" />
              </td>
              <td>
                <AppStatusChip
                  :label="article.actif ? 'Actif' : 'Inactif'"
                  :tone="article.actif ? 'success' : 'neutral'"
                />
              </td>
              <td
                v-if="canWrite"
                class="text-end"
                @click.stop
                @keydown.enter.stop
              >
                <VMenu>
                  <template #activator="{ props: menuProps }">
                    <IconBtn
                      v-bind="menuProps"
                      :aria-label="`Actions pour ${article.nom}`"
                      :disabled="busyId === article.id"
                    >
                      <VIcon icon="ri-more-2-fill" />
                    </IconBtn>
                  </template>
                  <VList>
                    <VListItem
                      prepend-icon="ri-pencil-line"
                      title="Modifier"
                      @click="editArticle(article)"
                    />
                    <VListItem
                      :prepend-icon="article.actif ? 'ri-forbid-line' : 'ri-checkbox-circle-line'"
                      :title="article.actif ? 'Désactiver' : 'Réactiver'"
                      @click="toggle(article)"
                    />
                  </VList>
                </VMenu>
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

    <ArticleFormDialog
      v-model="formOpen"
      :article="edited"
      :suggestions="usedCategories"
      @saved="refresh"
    />

    <AppImportDialog
      v-if="canWrite"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="refresh"
    />
  </div>
</template>

<style scoped>
.article-name {
  max-inline-size: 22rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (width <= 600px) {
  .article-name {
    max-inline-size: 10rem;
  }
}
</style>
