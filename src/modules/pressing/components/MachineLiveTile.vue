<!--
  Tuile d'une machine au travail : nom, commande, barre de progression du cycle (écoulé et restant
  calculés depuis le début réel et la fin estimée), badge de retard et actions rapides en slot.
-->
<script setup lang="ts">
import { formatHeure } from '../commandes'
import { CATEGORY_INFO, STATE_INFO, formatMinutes } from '../labels'
import type { MachineCategory, MachineState } from '../types'

const props = defineProps<{
  nom: string
  categorie: MachineCategory
  etat: MachineState
  commandeNumero?: string | null

  /** Identifiant de la commande : la tuile mène alors à sa fiche (sinon à la liste filtrée par numéro). */
  commandeId?: string | null
  debutReel?: string | null
  finEstimee?: string | null

  /** Horloge commune (millisecondes) : toutes les tuiles avancent ensemble. */
  now: number
}>()

const info = computed(() => STATE_INFO[props.etat])

const start = computed(() => props.debutReel ? new Date(props.debutReel).getTime() : null)
const end = computed(() => props.finEstimee ? new Date(props.finEstimee).getTime() : null)

const cycling = computed(() => props.etat === 'en_cycle')

const elapsed = computed(() => start.value === null ? null : Math.max(0, Math.floor((props.now - start.value) / 60000)))
const remaining = computed(() => end.value === null ? null : Math.max(0, Math.ceil((end.value - props.now) / 60000)))
const late = computed(() => cycling.value && end.value !== null && props.now > end.value)
const overrun = computed(() => late.value && end.value !== null ? Math.max(1, Math.floor((props.now - end.value) / 60000)) : 0)

const progress = computed(() => {
  if (start.value === null || end.value === null || end.value <= start.value)
    return null

  return Math.max(0, Math.min(100, Math.round((props.now - start.value) / (end.value - start.value) * 100)))
})

const color = computed(() => late.value ? 'error' : info.value.color)
</script>

<template>
  <div
    class="live-tile pa-4"
    :class="{ 'live-tile--late': late }"
    :style="{ '--tone': color.startsWith('#') ? color : `rgb(var(--v-theme-${color}))` }"
  >
    <div class="d-flex align-start gap-3">
      <VAvatar
        :color="color"
        variant="tonal"
        rounded
        size="40"
        class="flex-shrink-0"
      >
        <VIcon :icon="CATEGORY_INFO[categorie].icon" />
      </VAvatar>
      <div class="min-w-0 flex-grow-1">
        <div class="d-flex flex-wrap align-center gap-x-2 gap-y-1">
          <span class="text-subtitle-1 font-weight-semibold text-high-emphasis">{{ nom }}</span>
          <VChip
            v-if="late"
            color="error"
            size="x-small"
            label
            variant="flat"
            prepend-icon="ri-alarm-warning-line"
          >
            En retard
          </VChip>
          <VChip
            v-else-if="!cycling"
            :color="info.color"
            size="x-small"
            label
            variant="tonal"
            :prepend-icon="info.icon"
          >
            {{ info.label }}
          </VChip>
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ CATEGORY_INFO[categorie].label }}
          <template v-if="commandeNumero">
            ·
            <RouterLink
              :to="commandeId ? `/pressing/commandes/${commandeId}` : { path: '/pressing/commandes', query: { q: commandeNumero } }"
              class="live-tile__link"
            >
              {{ commandeNumero }}
            </RouterLink>
          </template>
        </div>
      </div>
      <div
        v-if="finEstimee && cycling"
        class="text-end flex-shrink-0"
      >
        <div class="text-caption text-medium-emphasis">
          Fin estimée
        </div>
        <div class="text-subtitle-1 font-weight-semibold tabular-nums">
          {{ formatHeure(finEstimee) }}
        </div>
      </div>
    </div>

    <template v-if="cycling">
      <VProgressLinear
        v-if="progress !== null"
        :model-value="progress"
        :color="color"
        height="8"
        rounded
        bg-opacity="0.16"
        class="mt-4"
        :aria-label="`Avancement du cycle de ${nom}`"
      />
      <div class="d-flex flex-wrap justify-space-between gap-x-4 text-body-2 mt-2">
        <span class="text-medium-emphasis">
          Écoulé : <strong class="text-high-emphasis tabular-nums">{{ formatMinutes(elapsed) }}</strong>
        </span>
        <span
          v-if="late"
          class="text-error font-weight-medium tabular-nums"
        >
          Dépasse de {{ formatMinutes(overrun) }}
        </span>
        <span
          v-else
          class="text-medium-emphasis"
        >
          Restant : <strong class="text-high-emphasis tabular-nums">{{ formatMinutes(remaining) }}</strong>
        </span>
      </div>
    </template>
    <p
      v-else
      class="text-body-2 text-medium-emphasis mb-0 mt-3"
    >
      {{ info.hint }}
    </p>

    <div
      v-if="$slots.default"
      class="d-flex flex-wrap gap-2 mt-4"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.live-tile {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-inline-start: 4px solid var(--tone);
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
}

.live-tile--late {
  background: rgba(var(--v-theme-error), 0.05);
}

.live-tile__link {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
  text-decoration: none;
}

.live-tile__link:hover {
  text-decoration: underline;
}
</style>
