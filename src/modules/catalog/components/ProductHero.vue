<!--
  Tête d'une fiche de plat ou de boisson : halo orange et trame de points (comme le bandeau des
  pages), vignette, nom, prix en grand, et les pastilles d'état en slot.
-->
<script setup lang="ts">
import ProductAvatar from './ProductAvatar.vue'

defineProps<{
  name: string
  price: string | number
  currency?: string
  photoUrl?: string | null
  icon: string
  color?: string
  muted?: boolean
}>()
</script>

<template>
  <section
    class="product-hero"
    :class="{ 'product-hero--muted': muted }"
  >
    <div class="d-flex align-center gap-4">
      <ProductAvatar
        :photo-url="photoUrl"
        :icon="icon"
        :color="color"
        :muted="muted"
        :size="72"
      />
      <div class="min-w-0">
        <h3 class="text-h6 text-wrap product-hero__name">
          {{ name }}
        </h3>
        <div class="product-hero__price tabular-nums">
          <AppMoney
            :amount="price"
            :currency="currency"
          />
        </div>
      </div>
    </div>
    <div
      v-if="$slots.default"
      class="d-flex flex-wrap gap-2 mt-4"
    >
      <slot />
    </div>
  </section>
</template>

<style scoped>
.product-hero {
  position: relative;
  padding: 20px;
  border-block-end: 1px solid rgba(var(--v-border-color), 0.3);
  background:
    radial-gradient(circle at 12% 0%, rgba(var(--v-theme-primary), 0.18), transparent 60%),
    linear-gradient(135deg, rgba(var(--v-theme-primary), 0.08), transparent 70%);
}

.product-hero::before {
  position: absolute;
  content: "";
  inset: 0;
  background-image: radial-gradient(rgba(var(--v-theme-on-surface), 0.12) 1px, transparent 1px);
  background-size: 16px 16px;
  mask-image: linear-gradient(90deg, transparent 35%, #000 100%);
  opacity: 0.5;
  pointer-events: none;
}

.product-hero > * {
  position: relative;
}

.product-hero--muted {
  background: linear-gradient(135deg, rgba(var(--v-theme-on-surface), 0.06), transparent 70%);
}

.product-hero__name {
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.product-hero__price {
  margin-block-start: 2px;
  color: rgb(var(--v-theme-primary));
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
}

.product-hero--muted .product-hero__price {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
