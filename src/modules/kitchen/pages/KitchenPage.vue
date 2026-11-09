<script setup lang="ts">
import { useFullscreen, useNow } from '@vueuse/core'
import { useDisplay } from 'vuetify'
import TicketLane from '../components/TicketLane.vue'
import { useKitchenBoard } from '../composables/useKitchenBoard'
import type { BoardView } from '../composables/useKitchenBoard'
import { LANES, STATIONS, formatElapsed, longestWaitMs, urgencyOf } from '../labels'
import type { Lane } from '../types'
import { useConfirm } from '@/composables/useConfirm'
import { useTenantStore } from '@/stores/tenant.store'

const board = useKitchenBoard()
const tenant = useTenantStore()
const askConfirm = useConfirm()
const { smAndDown } = useDisplay()

const root = ref<HTMLElement>()
const { isFullscreen, isSupported: canFullscreen, toggle: toggleFullscreen } = useFullscreen(root)

// Un seul minuteur pour tous les tickets : la seconde qui passe les met tous à jour.
const now = useNow({ interval: 1000 })
const nowMs = computed(() => now.value.getTime())

const canManage = computed(() => tenant.can('management'))
const current = computed(() => STATIONS.find(item => item.value === board.station.value) ?? STATIONS[0])

const stationOptions = computed(() => STATIONS.map(item => ({
  value: item.value,
  title: `${item.title} · ${board.counts.value[item.value]}`,
})))

const viewOptions: { value: BoardView; title: string }[] = [
  { value: 'lanes', title: 'Par ticket' },
  { value: 'all', title: 'Tout le service' },
]

// Sur téléphone, une colonne à la fois : des onglets, avec le nombre de tickets de chacune.
const mobileLane = ref<Lane>('QUEUED')

const laneOptions = computed(() => LANES.map(lane => ({
  value: lane.value,
  title: `${lane.short} · ${board.lanes.value[lane.value].length}`,
})))

const visibleLanes = computed(() => (smAndDown.value ? LANES.filter(lane => lane.value === mobileLane.value) : LANES))

const openCount = computed(() => board.openTickets.value.length)
const readyCount = computed(() => board.lanes.value.READY.length)
const hasAnything = computed(() => openCount.value + readyCount.value + board.recallable.value.length > 0)

// Plus longue attente : l'urgence suit les mêmes seuils que les minuteurs des cartes.
const waitMs = computed(() => longestWaitMs(board.openTickets.value, nowMs.value))

const WAIT_TONE = { alert: 'error', warning: 'warning', normal: 'success' } as const
const waitTone = computed(() => WAIT_TONE[urgencyOf(waitMs.value)])

const totalArticles = computed(() => board.totals.value.reduce((sum, item) => sum + item.quantity, 0))
const largestTotal = computed(() => Math.max(1, ...board.totals.value.map(item => item.quantity)))

const staleSince = computed(() => {
  if (!board.staleSince.value)
    return ''

  return new Date(board.staleSince.value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
})

async function expire() {
  const accepted = await askConfirm({
    title: 'Annuler les tickets périmés ?',
    text: 'Les tickets encore à faire, trop anciens pour être servis, seront annulés et ne s\'afficheront plus. Cette action ne peut pas être annulée.',
    confirmLabel: 'Annuler les tickets',
    danger: true,
  })

  if (accepted)
    await board.expireStale()
}
</script>

<template>
  <div
    ref="root"
    class="kitchen"
    :class="{ 'kitchen--fullscreen': isFullscreen }"
  >
    <AppHero
      eyebrow="Cuisine et bar"
      :title="current.title"
      :subtitle="`Les commandes de ${current.place}, en direct. Touchez le gros bouton pour passer à l'étape suivante.`"
      :live="board.isLive.value"
      class="kitchen-hero"
    >
      <template #eyebrow-extra>
        {{ board.isLive.value ? 'En direct' : 'Reconnexion…' }}
      </template>
      <template #actions>
        <AppSegmented
          v-model="board.station.value"
          :options="stationOptions"
          label="Poste de production"
          class="kitchen-station"
        />

        <VBtn
          class="kitchen-sound"
          variant="tonal"
          :color="board.soundEnabled.value ? 'primary' : 'secondary'"
          :prepend-icon="board.soundEnabled.value ? 'ri-volume-up-line' : 'ri-volume-mute-line'"
          :aria-pressed="board.soundEnabled.value"
          aria-label="Son des nouvelles commandes"
          @click="board.toggleSound()"
        >
          {{ board.soundEnabled.value ? 'Son activé' : 'Activer le son' }}
        </VBtn>

        <VBtn
          v-if="canFullscreen"
          icon="ri-fullscreen-line"
          variant="tonal"
          :aria-label="isFullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'"
          @click="toggleFullscreen"
        />
      </template>
    </AppHero>

    <VAlert
      v-if="board.stale.value"
      type="warning"
      variant="tonal"
      role="status"
      class="kitchen-banner"
    >
      <div class="d-flex flex-wrap align-center justify-space-between gap-3">
        <span>
          Données anciennes{{ staleSince ? ` (dernière mise à jour à ${staleSince})` : '' }} : la dernière actualisation a échoué. L'écran réessaie seul.
        </span>
        <VBtn
          size="small"
          variant="outlined"
          prepend-icon="ri-refresh-line"
          @click="board.refresh()"
        >
          Réessayer
        </VBtn>
      </div>
    </VAlert>

    <VAlert
      v-if="board.soundEnabled.value && board.soundBlocked.value"
      type="warning"
      variant="tonal"
      role="status"
      class="kitchen-banner"
    >
      <div class="d-flex flex-wrap align-center justify-space-between gap-3">
        <span>Le navigateur bloque le son : les nouvelles commandes ne sonneront pas.</span>
        <VBtn
          size="small"
          variant="outlined"
          prepend-icon="ri-volume-up-line"
          @click="board.unlockSound()"
        >
          Activer le son
        </VBtn>
      </div>
    </VAlert>

    <AppErrorState
      v-if="board.error.value && !board.loadedOnce.value"
      :error="board.error.value"
      @retry="board.refresh()"
    />

    <div
      v-else-if="!board.loadedOnce.value"
      class="kitchen-skeleton"
      aria-busy="true"
      aria-label="Chargement des commandes"
    >
      <VSkeletonLoader
        v-for="n in 3"
        :key="n"
        type="heading, card, card"
      />
    </div>

    <template v-else>
      <AppMetricGrid class="kitchen-metrics">
        <AppMetricTile
          label="À préparer"
          icon="ri-inbox-line"
          color="info"
          hint="Pas encore commencées"
        >
          <AppAnimatedNumber
            v-slot="{ current: shown }"
            :value="board.lanes.value.QUEUED.length"
          >
            {{ shown }}
          </AppAnimatedNumber>
        </AppMetricTile>

        <AppMetricTile
          label="En préparation"
          icon="ri-fire-line"
          color="warning"
          hint="En cours de cuisson"
        >
          <AppAnimatedNumber
            v-slot="{ current: shown }"
            :value="board.lanes.value.IN_PREPARATION.length"
          >
            {{ shown }}
          </AppAnimatedNumber>
        </AppMetricTile>

        <AppMetricTile
          label="Prêts à servir"
          icon="ri-check-double-line"
          color="success"
          hint="À porter en salle"
        >
          <AppAnimatedNumber
            v-slot="{ current: shown }"
            :value="readyCount"
          >
            {{ shown }}
          </AppAnimatedNumber>
        </AppMetricTile>

        <AppMetricTile
          label="Plus longue attente"
          icon="ri-timer-line"
          :color="waitTone"
          :hint="openCount ? `Ticket le plus ancien : ${formatElapsed(waitMs)}` : 'Rien en attente'"
        >
          <span class="tabular-nums">{{ openCount ? formatElapsed(waitMs) : '—' }}</span>
        </AppMetricTile>
      </AppMetricGrid>

      <div class="kitchen-toolbar">
        <AppSegmented
          v-model="board.view.value"
          :options="viewOptions"
          label="Affichage"
          class="kitchen-all-day-toggle"
        />

        <VBtn
          v-if="canManage"
          variant="text"
          size="small"
          prepend-icon="ri-delete-bin-line"
          @click="expire"
        >
          Annuler les tickets périmés
        </VBtn>
      </div>

      <AppEmptyState
        v-if="!hasAnything"
        class="kitchen-empty"
        icon="ri-restaurant-2-line"
        :title="`Rien à préparer pour ${current.place}`"
        text="Les nouvelles commandes s'afficheront ici dès qu'elles seront envoyées, sans recharger la page."
      />

      <template v-else-if="board.view.value === 'lanes'">
        <AppSegmented
          v-if="smAndDown"
          v-model="mobileLane"
          :options="laneOptions"
          label="Colonne affichée"
          class="kitchen-tabs"
        />

        <div
          class="kitchen-lanes"
          :class="{ 'kitchen-lanes--single': smAndDown }"
        >
          <TicketLane
            v-for="lane in visibleLanes"
            :key="lane.value"
            :lane="lane"
            :tickets="board.lanes.value[lane.value]"
            :recallable="lane.value === 'READY' ? board.recallable.value : []"
            :now="nowMs"
            :fresh="board.fresh.value"
            :busy="board.busy.value"
            @advance="board.advance"
            @recall="board.recall"
            @toggle-priority="board.togglePriority"
          />
        </div>
      </template>

      <VCard
        v-else
        class="kitchen-all-day"
        aria-labelledby="kitchen-all-day-title"
      >
        <div class="kitchen-all-day__head">
          <h2
            id="kitchen-all-day-title"
            class="kitchen-all-day__title"
          >
            Tout le service
          </h2>
          <p class="kitchen-all-day__meta tabular-nums">
            {{ openCount }} ticket{{ openCount > 1 ? 's' : '' }} à faire · {{ totalArticles }} article{{ totalArticles > 1 ? 's' : '' }}
          </p>
        </div>

        <ol
          v-if="board.totals.value.length"
          class="kitchen-all-day__list"
        >
          <li
            v-for="item in board.totals.value"
            :key="item.name"
            class="kitchen-all-day__row"
          >
            <span class="kitchen-all-day__name">{{ item.name }}</span>
            <span
              class="kitchen-all-day__bar"
              aria-hidden="true"
            >
              <span :style="{ inlineSize: `${(item.quantity / largestTotal) * 100}%` }" />
            </span>
            <span class="kitchen-all-day__qty tabular-nums">{{ item.quantity }}</span>
          </li>
        </ol>

        <AppEmptyState
          v-else
          icon="ri-checkbox-circle-line"
          title="Rien à faire"
          text="Aucun article en attente pour ce poste."
        />
      </VCard>
    </template>

    <output
      class="visually-hidden"
      aria-live="polite"
    >
      {{ board.announcement.value }}
    </output>
  </div>
</template>

<style scoped>
.kitchen {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-inline-size: 0;
}

/* En plein écran, l'élément remplace la page : il lui faut son propre fond et son défilement. */
.kitchen--fullscreen {
  overflow: auto;
  padding: 1.25rem;
  background: rgb(var(--v-theme-background));
}

.kitchen-station {
  max-inline-size: 100%;
}

.kitchen-banner {
  border-radius: 14px;
}

.kitchen-metrics {
  margin-block-start: 0.25rem;
}

.kitchen-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  justify-content: space-between;
}

.kitchen-tabs {
  max-inline-size: 100%;
  overflow-x: auto;
}

.kitchen-lanes {
  align-items: start;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.kitchen-lanes--single {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 1099px) and (min-width: 600px) {
  .kitchen-lanes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.kitchen-empty {
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-radius: 16px;
}

.kitchen .kitchen-all-day {
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04);
  padding: 1.25rem 1.5rem;
}

.kitchen-all-day__head {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  justify-content: space-between;
  margin-block-end: 1rem;
}

.kitchen-all-day__title {
  font-size: 1.25rem;
  font-weight: 700;
}

.kitchen-all-day__meta {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  margin: 0;
}

.kitchen-all-day__list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.kitchen-all-day__row {
  align-items: center;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1fr) minmax(4rem, 2fr) 3.5rem;
  min-block-size: 44px;
}

.kitchen-all-day__name {
  font-size: 1.0625rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.kitchen-all-day__bar {
  background: rgba(var(--v-theme-on-surface), 0.07);
  block-size: 10px;
  border-radius: 999px;
  overflow: hidden;
}

.kitchen-all-day__bar > span {
  background: rgb(var(--v-theme-primary));
  block-size: 100%;
  border-radius: 999px;
  display: block;
}

.kitchen-all-day__qty {
  font-size: 1.25rem;
  font-weight: 800;
  text-align: end;
}

.kitchen-skeleton {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 1099px) {
  .kitchen-skeleton {
    grid-template-columns: minmax(0, 1fr);
  }
}

.visually-hidden {
  block-size: 1px;
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 599px) {
  .kitchen-sound,
  .kitchen-station {
    flex: 1 1 100%;
  }

  /* Quatre tuiles sur deux colonnes : la dernière prend toute la largeur, pour ne pas rester seule. */
  .kitchen-metrics > :last-child {
    grid-column: 1 / -1;
  }

  .kitchen .kitchen-all-day {
    padding: 1rem;
  }
}
</style>
