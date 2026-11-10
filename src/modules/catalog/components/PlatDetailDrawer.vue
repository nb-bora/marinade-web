<!-- Fiche d'un plat, en tiroir latéral : prix, état, poste, préparation, accompagnements et actions. -->
<script setup lang="ts">
import { catalogApi } from '../api'
import { useProductDetail } from '../composables/useProductDetail'
import { stationLabel } from '../products'
import type { Plat } from '../types'
import ProductDrawerShell from './ProductDrawerShell.vue'
import ProductHero from './ProductHero.vue'
import { formatDateTime } from '@/lib/format'

defineProps<{
  canWrite: boolean
  categoryName: string | null

  /** Une bascule de disponibilité est en cours. */
  busy: boolean
}>()

const emit = defineEmits<{
  edit: [plat: Plat]
  toggle: [plat: Plat]
}>()

/** Identifiant du plat affiché ; `null` ferme le tiroir. */
const platId = defineModel<string | null>({ required: true })

const { detail, loading, error, retry, reload } = useProductDetail(platId, (id, signal) => catalogApi.plat(id, signal))

const isOpen = computed({
  get: () => platId.value !== null,
  set: open => {
    if (!open)
      platId.value = null
  },
})

/** Recharge la fiche après une modification faite depuis la page. */
defineExpose({ reload })
</script>

<template>
  <ProductDrawerShell
    v-model="isOpen"
    title="Fiche du plat"
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
        :photo-url="detail.photo_url"
        icon="ri-restaurant-2-line"
        :muted="!detail.disponible"
      >
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
                icon="ri-timer-line"
                size="14"
              />
              Préparation
            </dt>
            <dd class="tabular-nums">
              {{ detail.temps_preparation != null ? `${detail.temps_preparation} min` : 'Non renseignée' }}
            </dd>
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

        <template v-if="detail.composants.length">
          <h3 class="text-subtitle-2 font-weight-semibold mt-6 mb-2">
            Accompagnements proposés
          </h3>
          <ul class="chips">
            <li
              v-for="composant in detail.composants"
              :key="composant.id"
              class="chips__item"
            >
              {{ composant.nom }}
            </li>
          </ul>
        </template>

        <div class="text-caption text-medium-emphasis mt-6">
          <div>Ajouté le {{ formatDateTime(detail.created_at) }}</div>
          <div>Modifié le {{ formatDateTime(detail.updated_at) }}</div>
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
            Modifier ce plat
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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chips__item {
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  font-size: 0.8125rem;
  font-weight: 600;
}
</style>
