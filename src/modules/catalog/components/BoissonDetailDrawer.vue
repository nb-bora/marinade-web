<!-- Fiche d'une boisson, en tiroir latéral. -->
<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { catalogApi } from '../api'
import type { Boisson } from '../types'
import ProductAvatar from './ProductAvatar.vue'
import { formatDateTime } from '@/lib/format'

defineProps<{ canWrite: boolean }>()

const emit = defineEmits<{ edit: [boisson: Boisson] }>()

/** Identifiant de la boisson affichée ; `null` ferme le tiroir. */
const boissonId = defineModel<string | null>({ required: true })

const detail = ref<Boisson | null>(null)
const loading = ref(false)
const error = ref<unknown>(null)

const isOpen = computed({
  get: () => boissonId.value !== null,
  set: open => {
    if (!open)
      boissonId.value = null
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
    const result = await catalogApi.boisson(id, current.signal)

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

watch(boissonId, id => {
  detail.value = null
  if (id)
    load(id)
}, { immediate: true })

onScopeDispose(() => controller?.abort())

defineExpose({ reload: () => boissonId.value && load(boissonId.value) })
</script>

<template>
  <VNavigationDrawer
    v-model="isOpen"
    location="end"
    temporary
    width="440"
    aria-label="Fiche de la boisson"
  >
    <div class="d-flex align-center justify-space-between pa-4 pb-2">
      <h2 class="text-h6">
        Fiche de la boisson
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
        @retry="boissonId && load(boissonId)"
      />

      <VSkeletonLoader
        v-else-if="loading && !detail"
        type="heading, list-item-two-line, list-item-two-line, list-item-two-line"
      />

      <template v-else-if="detail">
        <div class="d-flex align-center gap-4 mb-4">
          <ProductAvatar
            icon="ri-goblet-line"
            :color="detail.alcool ? 'warning' : 'info'"
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
            :label="detail.alcool ? 'Avec alcool' : 'Sans alcool'"
            :tone="detail.alcool ? 'warning' : 'info'"
            :icon="detail.alcool ? 'ri-goblet-fill' : 'ri-drop-line'"
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
            <VListItemSubtitle>Catégorie</VListItemSubtitle>
            <VListItemTitle>{{ detail.category || 'Sans catégorie' }}</VListItemTitle>
          </VListItem>
          <VListItem class="px-0">
            <VListItemSubtitle>Ajoutée le</VListItemSubtitle>
            <VListItemTitle>{{ formatDateTime(detail.created_at) }}</VListItemTitle>
          </VListItem>
          <VListItem class="px-0">
            <VListItemSubtitle>Dernière modification</VListItemSubtitle>
            <VListItemTitle>{{ formatDateTime(detail.updated_at) }}</VListItemTitle>
          </VListItem>
        </VList>

        <VBtn
          v-if="canWrite"
          block
          class="mt-6"
          prepend-icon="ri-pencil-line"
          @click="emit('edit', detail)"
        >
          Modifier cette boisson
        </VBtn>
      </template>
    </div>
  </VNavigationDrawer>
</template>
