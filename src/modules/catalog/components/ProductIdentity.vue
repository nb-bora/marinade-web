<!--
  Première colonne d'un tableau de la carte : vignette, nom, description sur une ligne, et (sur
  téléphone, où les autres colonnes disparaissent) une ligne d'informations en slot.
-->
<script setup lang="ts">
import ProductAvatar from './ProductAvatar.vue'

defineProps<{
  name: string
  description?: string | null
  photoUrl?: string | null
  icon: string
  color?: string

  /** Article indisponible : vignette et textes passent en retrait. */
  muted?: boolean
}>()
</script>

<template>
  <div
    class="product-identity"
    :class="{ 'product-identity--muted': muted }"
  >
    <ProductAvatar
      :photo-url="photoUrl"
      :icon="icon"
      :color="color"
      :muted="muted"
      :size="42"
    />
    <div class="min-w-0">
      <div
        class="product-identity__name text-body-1 font-weight-medium"
        :title="name"
      >
        {{ name }}
      </div>
      <div
        v-if="description"
        class="product-identity__description text-body-2 text-medium-emphasis"
        :title="description"
      >
        {{ description }}
      </div>
      <div
        v-if="$slots.default"
        class="product-identity__meta d-md-none"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-block: 8px;
}

.product-identity__name,
.product-identity__description {
  max-inline-size: 24rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-identity__name {
  color: rgb(var(--v-theme-on-surface));
}

.product-identity--muted .product-identity__name {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.product-identity__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin-block-start: 4px;
}

@media (width <= 599px) {
  .product-identity__name,
  .product-identity__description {
    max-inline-size: 11rem;
  }
}
</style>
