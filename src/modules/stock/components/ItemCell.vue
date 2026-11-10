<!--
  Cellule « objet » des tableaux du stock : pastille d'icône tonale, intitulé et sous-titre. Même grammaire que les
  cartes de menu : pastille arrondie teintée, grisée quand l'élément est inactif.
-->
<script setup lang="ts">
withDefaults(defineProps<{
  icon: string
  title: string
  subtitle?: string
  color?: string
  muted?: boolean

  /** Cache la pastille sur téléphone, pour laisser la place au texte. */
  hideAvatarOnMobile?: boolean
}>(), { color: 'primary', subtitle: undefined })
</script>

<template>
  <div class="item-cell d-flex align-center gap-3 py-2">
    <VAvatar
      :color="muted ? 'secondary' : color"
      variant="tonal"
      rounded="lg"
      size="40"
      :class="{ 'd-none d-sm-flex': hideAvatarOnMobile, 'opacity-60': muted }"
    >
      <VIcon
        :icon="icon"
        size="20"
      />
    </VAvatar>
    <div class="min-w-0">
      <div class="item-cell__title text-body-1 font-weight-medium text-high-emphasis text-truncate">
        {{ title }}
      </div>
      <div
        v-if="subtitle || $slots.subtitle"
        class="text-body-2 text-medium-emphasis"
      >
        <slot name="subtitle">
          {{ subtitle }}
        </slot>
      </div>
      <slot />
    </div>
  </div>
</template>
