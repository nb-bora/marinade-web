<!-- Fiche d'un plat, en tiroir latéral. -->
<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { catalogApi } from '../api'
import type { Plat } from '../types'
import ProductAvatar from './ProductAvatar.vue'
import { formatDateTime } from '@/lib/format'

defineProps<{
  canWrite: boolean
  categoryName: string | null
}>()

const emit = defineEmits<{ edit: [plat: Plat] }>()

/** Identifiant du plat affiché ; `null` ferme le tiroir. */
const platId = defineModel<string | null>({ required: true })

const detail = ref<Plat | null>(null)
const loading = ref(false)
const error = ref<unknown>(null)

const isOpen = computed({
  get: () => platId.value !== null,
  set: open => {
    if (!open)
      platId.value = null
  },
})

let controller: AbortController | null = null

onKeyStroke('Escape', () => {
  if (isOpen.value)
    isOpen.value = false
})

async function load(id: string) {
  controller?.abort()

  const current = new AbortController()

  controller = current
  loading.value = true
  error.value = null

  try {
    const result = await catalogApi.plat(id, current.signal)

    if (!current.signal.aborted)
      detail.value = result
  }
  catch (cause) {
    if (!current.signal.aborted)
      error.value = cause
  }
  finally {
    if (!current.signal.aborted)
      loading.value = false
  }
}

watch(platId, id => {
  detail.value = null
  if (id)
    load(id)
}, { immediate: true })

onScopeDispose(() => controller?.abort())

/** Recharge la fiche après une modification faite depuis la page. */
defineExpose({ reload: () => platId.value && load(platId.value) })
</script>

<template>
  <VNavigationDrawer
    v-model="isOpen"
    location="end"
    temporary
    width="440"
    aria-label="Fiche du plat"
  >
    <div class="d-flex align-center justify-space-between pa-4 pb-2">
      <h2 class="text-h6">
        Fiche du plat
      </h2>
      <IconBtn
        aria-label="Fermer"
        @click="isOpen = false"
      >
        <VIcon icon="ri-close-line" />
      </IconBtn>
    </div>

    <div class="px-4 pb-6">
      <AppErrorState
        v-if="error"
        :error="error"
        @retry="platId && load(platId)"
      />

      <VSkeletonLoader
        v-else-if="loading && !detail"
        type="heading, list-item-two-line, list-item-two-line, list-item-two-line"
      />

      <template v-else-if="detail">
        <div class="d-flex align-center gap-4 mb-4">
          <ProductAvatar
            :photo-url="detail.photo_url"
            icon="ri-restaurant-2-line"
            :size="72"
          />
          <div class="min-w-0">
            <div class="text-h6 text-wrap">
              {{ detail.nom }}
            </div>
            <div class="text-h5 font-weight-semibold text-primary mt-1">
              <AppMoney
                :amount="detail.prix"
                :currency="detail.devise"
              />
            </div>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2 mb-4">
          <AppStatusChip
            :label="detail.disponible ? 'Disponible' : 'Indisponible'"
            :tone="detail.disponible ? 'success' : 'neutral'"
            :icon="detail.disponible ? 'ri-checkbox-circle-line' : 'ri-pause-circle-line'"
          />
          <AppStatusChip
            v-if="categoryName"
            :label="categoryName"
            tone="info"
            icon="ri-price-tag-3-line"
          />
        </div>

        <p
          v-if="detail.description"
          class="text-body-1 mb-4"
        >
          {{ detail.description }}
        </p>

        <VList
          density="compact"
          class="pa-0 bg-transparent"
        >
          <VListItem class="px-0">
            <VListItemSubtitle>Temps de préparation</VListItemSubtitle>
            <VListItemTitle>
              {{ detail.temps_preparation != null ? `${detail.temps_preparation} min` : 'Non renseigné' }}
            </VListItemTitle>
          </VListItem>
          <VListItem class="px-0">
            <VListItemSubtitle>Ajouté le</VListItemSubtitle>
            <VListItemTitle>{{ formatDateTime(detail.created_at) }}</VListItemTitle>
          </VListItem>
          <VListItem class="px-0">
            <VListItemSubtitle>Dernière modification</VListItemSubtitle>
            <VListItemTitle>{{ formatDateTime(detail.updated_at) }}</VListItemTitle>
          </VListItem>
        </VList>

        <template v-if="detail.composants.length">
          <h3 class="text-subtitle-1 font-weight-medium mt-5 mb-2">
            Accompagnements proposés
          </h3>
          <div class="d-flex flex-wrap gap-2">
            <VChip
              v-for="composant in detail.composants"
              :key="composant.id"
              size="small"
              label
              variant="tonal"
            >
              {{ composant.nom }}
            </VChip>
          </div>
        </template>

        <VBtn
          v-if="canWrite"
          block
          class="mt-6"
          prepend-icon="ri-pencil-line"
          @click="emit('edit', detail)"
        >
          Modifier ce plat
        </VBtn>
      </template>
    </div>
  </VNavigationDrawer>
</template>
