<script setup lang="ts">
import { useFullscreen } from '@vueuse/core'
import TicketLane from '../components/TicketLane.vue'
import { useKitchenBoard } from '../composables/useKitchenBoard'
import { LANES, STATIONS } from '../labels'

const board = useKitchenBoard()

const root = ref<HTMLElement>()
const { isFullscreen, isSupported: canFullscreen, toggle: toggleFullscreen } = useFullscreen(root)

// Un seul minuteur pour tous les tickets : la seconde qui passe les met tous à jour.
const now = useNow({ interval: 1000 })

const stationOptions = computed(() => STATIONS.map(item => ({
  value: item.value,
  title: `${item.title} · ${board.counts.value[item.value]}`,
})))

const current = computed(() => STATIONS.find(item => item.value === board.station.value) ?? STATIONS[0])
const isLive = computed(() => board.socketState.value === 'open')

const total = computed(() => LANES.reduce((sum, lane) => sum + board.lanes.value[lane.value].length, 0))
</script>

<template>
  <div
    ref="root"
    class="kitchen"
    :class="{ 'kitchen--fullscreen': isFullscreen }"
  >
    <AppPageHeader
      title="Cuisine et bar"
      subtitle="Les commandes à préparer, en direct. Touchez le gros bouton pour passer à l'étape suivante."
    >
      <template #actions>
        <AppSegmented
          v-model="board.station.value"
          :options="stationOptions"
          label="Poste de production"
        />

        <VChip
          :color="isLive ? 'success' : 'warning'"
          variant="tonal"
          label
          role="status"
        >
          <span
            class="live-dot me-2"
            :class="{ 'live-dot--on': isLive }"
          />
          {{ isLive ? 'En direct' : 'Reconnexion…' }}
        </VChip>

        <VBtn
          icon
          variant="tonal"
          :color="board.soundEnabled.value ? 'primary' : 'secondary'"
          :aria-label="board.soundEnabled.value ? 'Désactiver le son des nouvelles commandes' : 'Activer le son des nouvelles commandes'"
          :aria-pressed="board.soundEnabled.value"
          @click="board.toggleSound()"
        >
          <VIcon :icon="board.soundEnabled.value ? 'ri-volume-up-line' : 'ri-volume-mute-line'" />
          <VTooltip
            activator="parent"
            location="bottom"
          >
            {{ board.soundEnabled.value ? 'Son activé' : 'Son désactivé' }}
          </VTooltip>
        </VBtn>

        <VBtn
          v-if="canFullscreen"
          icon
          variant="tonal"
          :aria-label="isFullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'"
          @click="toggleFullscreen"
        >
          <VIcon :icon="isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'" />
          <VTooltip
            activator="parent"
            location="bottom"
          >
            {{ isFullscreen ? 'Quitter le plein écran' : 'Plein écran' }}
          </VTooltip>
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="board.error.value && !board.loadedOnce.value"
      :error="board.error.value"
      @retry="board.refresh()"
    />

    <div
      v-else-if="!board.loadedOnce.value"
      class="board"
    >
      <VSkeletonLoader
        v-for="lane in LANES"
        :key="lane.value"
        type="heading, card, card"
      />
    </div>

    <VCard
      v-else-if="total === 0"
      class="py-8"
    >
      <AppEmptyState
        icon="ri-restaurant-2-line"
        :title="`Rien à préparer pour ${current.place}`"
        text="Les nouvelles commandes s'afficheront ici dès qu'elles seront envoyées, sans recharger la page."
      />
    </VCard>

    <div
      v-else
      class="board"
    >
      <TicketLane
        v-for="lane in LANES"
        :key="lane.value"
        :lane="lane"
        :tickets="board.lanes.value[lane.value]"
        :now="now.getTime()"
        :fresh="board.fresh.value"
        :busy="board.busy.value"
        @advance="board.move($event, lane.action.next)"
      />
    </div>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
  gap: 1rem;
  align-items: start;
}

/* En plein écran, l'élément remplace la page : il lui faut son propre fond et son défilement. */
.kitchen--fullscreen {
  overflow: auto;
  padding: 1.25rem;
  background: rgb(var(--v-theme-background));
}

.live-dot {
  display: inline-block;
  inline-size: 10px;
  block-size: 10px;
  border-radius: 50%;
  background: currentcolor;
}

.live-dot--on {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-dot--on {
    animation: none;
  }
}
</style>
