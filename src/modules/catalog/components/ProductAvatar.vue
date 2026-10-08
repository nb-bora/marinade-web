<!-- Vignette d'un produit : sa photo si elle existe, sinon une icône colorée. -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  photoUrl?: string | null
  icon: string
  color?: string
  size?: number
  muted?: boolean
}>(), { color: 'primary', size: 40, photoUrl: null })

const broken = ref(false)

watch(() => props.photoUrl, () => {
  broken.value = false
})
</script>

<template>
  <VAvatar
    :color="muted ? 'secondary' : color"
    variant="tonal"
    rounded
    :size="size"
    :class="{ 'opacity-60': muted }"
  >
    <VImg
      v-if="photoUrl && !broken"
      :src="photoUrl"
      cover
      alt=""
      @error="broken = true"
    />
    <VIcon
      v-else
      :icon="icon"
      :size="Math.round(size * 0.55)"
    />
  </VAvatar>
</template>
