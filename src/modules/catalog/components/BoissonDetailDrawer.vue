<!-- Fiche d'une boisson, en tiroir latéral : prix, état, alcool, catégorie, poste et actions. -->
<script setup lang="ts">
import { catalogApi } from '../api'
import { useProductDetail } from '../composables/useProductDetail'
import { stationLabel } from '../products'
import type { Boisson } from '../types'
import ProductDrawerShell from './ProductDrawerShell.vue'
import ProductHero from './ProductHero.vue'
import { formatDateTime } from '@/lib/format'

defineProps<{
  canWrite: boolean

  /** Une bascule de disponibilité est en cours. */
  busy: boolean
}>()

const emit = defineEmits<{
  edit: [boisson: Boisson]
  toggle: [boisson: Boisson]
}>()

/** Identifiant de la boisson affichée ; `null` ferme le tiroir. */
const boissonId = defineModel<string | null>({ required: true })

const { detail, loading, error, retry, reload } = useProductDetail(boissonId, (id, signal) => catalogApi.boisson(id, signal))

const isOpen = computed({
  get: () => boissonId.value !== null,
  set: open => {
    if (!open)
      boissonId.value = null
  },
})

/** Recharge la fiche après une modification faite depuis la page. */
defineExpose({ reload })
</script>

<template>
  <ProductDrawerShell
    v-model="isOpen"
    title="Fiche de la boisson"
    :loading="loading"
    :error="error"
    :ready="detail !== null"
    @retry="retry"
  >
    <template v-if="detail">
      <ProductHero
        :name="detail.nom"
        :price="detail.prix"
        :currency="detail.devise"
        icon="ri-goblet-line"
        :color="detail.alcool ? 'warning' : 'info'"
        :muted="!detail.disponible"
      >
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
      </ProductHero>

      <div class="pa-5">
        <p
          class="text-body-1 mb-5"
          :class="{ 'text-medium-emphasis font-italic': !detail.description }"
        >
          {{ detail.description || 'Aucune description.' }}
        </p>

        <dl class="facts">
          <div class="facts__item">
            <dt>
              <VIcon
                icon="ri-price-tag-3-line"
                size="14"
              />
              Catégorie
            </dt>
            <dd>{{ detail.category || 'Sans catégorie' }}</dd>
          </div>
          <div class="facts__item">
            <dt>
              <VIcon
                icon="ri-store-2-line"
                size="14"
              />
              Poste
            </dt>
            <dd>{{ stationLabel(detail.station) ?? 'Non défini' }}</dd>
          </div>
        </dl>

        <div class="text-caption text-medium-emphasis mt-6">
          <div>Ajoutée le {{ formatDateTime(detail.created_at) }}</div>
          <div>Modifiée le {{ formatDateTime(detail.updated_at) }}</div>
        </div>

        <div
          v-if="canWrite"
          class="d-flex flex-column gap-2 mt-6"
        >
          <VBtn
            block
            prepend-icon="ri-pencil-line"
            @click="emit('edit', detail)"
          >
            Modifier cette boisson
          </VBtn>
          <VBtn
            block
            variant="tonal"
            :color="detail.disponible ? 'secondary' : 'success'"
            :prepend-icon="detail.disponible ? 'ri-pause-circle-line' : 'ri-play-circle-line'"
            :loading="busy"
            :disabled="busy"
            @click="emit('toggle', detail)"
          >
            {{ detail.disponible ? 'Marquer indisponible' : 'Remettre en vente' }}
          </VBtn>
        </div>
      </div>
    </template>
  </ProductDrawerShell>
</template>

<style scoped>
.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0;
}

.facts__item {
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.facts dt {
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  font-weight: 500;
}

.facts dd {
  margin: 2px 0 0;
  font-size: 1rem;
  font-weight: 600;
}
</style>
