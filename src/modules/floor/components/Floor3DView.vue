<!--
  Vue 3D du plan de salle : un niveau (`mode="level"`) ou tout l'immeuble empilé (`mode="building"`).
  Les tables ont la couleur de leur état ; sur une table occupée, les chaises « prises » portent cette
  couleur et les chaises libres restent grises : on voit les places libres d'un coup d'œil.
  La hauteur vient du parent (le composant remplit 100 % de sa boîte).
-->
<script setup lang="ts">
import { describeScene } from '../three/buildScene'
import type { Scene3DLevel, ViewMode } from '../three/sceneTypes'
import { FloorViewer } from '../three/viewer'

const props = defineProps<{
  levels: Scene3DLevel[]
  mode: ViewMode
  levelId: string | null
  selectedId: string | null
  dark: boolean
}>()

const emit = defineEmits<{
  select: [tableId: string]
  hover: [tableId: string | null]
}>()

const host = ref<HTMLElement | null>(null)
const supported = ref(true)

let viewer: FloorViewer | null = null

const label = computed(() => describeScene(props.levels, props.mode, props.levelId))

function push() {
  viewer?.update({
    levels: props.levels,
    mode: props.mode,
    levelId: props.levelId,
    selectedId: props.selectedId,
    dark: props.dark,
  })
}

onMounted(() => {
  if (!host.value)
    return

  if (!FloorViewer.supported()) {
    supported.value = false

    return
  }

  try {
    viewer = new FloorViewer(host.value, {
      select: id => emit('select', id),
      hover: id => emit('hover', id),
    })
    push()
  }
  catch {
    viewer?.dispose()
    viewer = null
    supported.value = false
  }
})

// Les données arrivent toutes les 5 s : `update` ne reconstruit que si la structure change.
watch(() => [props.levels, props.mode, props.levelId, props.selectedId, props.dark], push, { deep: true })

onBeforeUnmount(() => {
  viewer?.dispose()
  viewer = null
})
</script>

<template>
  <div
    class="floor3d"
    role="img"
    :aria-label="label"
  >
    <div
      ref="host"
      class="floor3d__canvas"
    />

    <div
      v-if="!supported"
      class="floor3d__fallback"
      role="alert"
    >
      <VIcon
        icon="ri-box-3-line"
        size="40"
      />
      <strong>La vue 3D n'est pas disponible</strong>
      <span>Votre navigateur ou votre appareil n'active pas WebGL. Le plan 2D reste disponible.</span>
    </div>

    <div
      v-else
      class="floor3d__tools"
      role="toolbar"
      aria-label="Caméra de la vue 3D"
    >
      <VBtn
        size="small"
        variant="flat"
        color="surface"
        class="text-none"
        prepend-icon="ri-map-2-line"
        @click="viewer?.setView('top')"
      >
        Vue du dessus
      </VBtn>
      <VBtn
        size="small"
        variant="flat"
        color="surface"
        class="text-none"
        prepend-icon="ri-box-3-line"
        @click="viewer?.setView('perspective')"
      >
        Vue en perspective
      </VBtn>
      <VBtn
        size="small"
        variant="flat"
        color="surface"
        class="text-none"
        prepend-icon="ri-focus-3-line"
        @click="viewer?.setView('reset')"
      >
        Recentrer
      </VBtn>
    </div>

    <div
      v-if="supported"
      class="floor3d__hint"
      aria-hidden="true"
    >
      Glisser pour tourner · molette pour zoomer · clic droit pour déplacer
    </div>
  </div>
</template>

<style scoped>
.floor3d {
  background: rgb(var(--v-theme-surface));
  block-size: 100%;
  border-radius: inherit;
  inline-size: 100%;
  min-block-size: 220px;
  overflow: hidden;
  position: relative;
}

.floor3d__canvas {
  block-size: 100%;
  inline-size: 100%;
  inset: 0;
  position: absolute;
}

.floor3d__tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  inset-block-start: 10px;
  inset-inline-start: 10px;
  max-inline-size: calc(100% - 20px);
  position: absolute;
}

.floor3d__tools :deep(.v-btn) {
  background: rgba(var(--v-theme-surface), 0.92);
  border: 1px solid rgba(var(--v-border-color), 0.16);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
}

.floor3d__hint {
  background: rgba(var(--v-theme-surface), 0.82);
  border-radius: 999px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.72rem;
  inset-block-end: 10px;
  inset-inline-start: 50%;
  max-inline-size: calc(100% - 20px);
  padding: 4px 12px;
  pointer-events: none;
  position: absolute;
  text-align: center;
  transform: translateX(-50%);
  white-space: nowrap;
}

.floor3d__fallback {
  align-items: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  display: flex;
  flex-direction: column;
  gap: 8px;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: absolute;
  text-align: center;
}

@media (max-width: 599px) {
  .floor3d__hint {
    display: none;
  }
}
</style>
