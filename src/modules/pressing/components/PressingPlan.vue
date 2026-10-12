<!--
  Plan du pressing vu du dessus : zones rectangulaires colorées et machines (cercle de hublot pour un
  lave-linge, carré pour un sèche-linge) teintées selon leur état. Zoom, déplacement du plan et mode
  « Aménager » (glisser-déposer des zones et des machines, grille magnétique, annulation).
  Même principe que le plan de salle, dont la logique est reprise dans `composables/`.
-->
<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { CATEGORY_INFO, STATES, STATE_INFO, ZONE_ICON_PATH, ZONE_INFO, formatCapacity, plural } from '../labels'
import { MAX_ZOOM, usePlanViewport } from '../composables/usePlanViewport'
import type { DragKind } from '../composables/usePlanViewport'
import { usePressingPlan } from '../composables/usePressingPlan'
import type { MachineNode, ZoneNode } from '../composables/usePressingPlan'
import type { PlanRect } from '../composables/planGeometry'
import type { MachineState, Plan } from '../types'
import { useConfirm } from '@/composables/useConfirm'

/** Ce que le plan remet à la page quand on enregistre l'aménagement. */
export interface LayoutPayload {
  zones: Array<{ id: string; rect: PlanRect }>
  machines: Array<{ id: string; x: number; y: number; zoneId: string | null }>
}

const props = defineProps<{
  plan: Plan | null
  canEdit: boolean
  selectedMachineId?: string | null
  selectedZoneId?: string | null
  saving?: boolean
}>()

const emit = defineEmits<{
  editingChange: [editing: boolean]
  selectMachine: [id: string]
  selectZone: [id: string]
  save: [payload: LayoutPayload]
}>()

const confirm = useConfirm()
const uid = useId()

const frame = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)

const { width: frameWidth } = useElementSize(frame)
const { width: svgWidth } = useElementSize(svg)

/** Sur téléphone le plan est plus haut que large (4/3) pour garder des machines lisibles. */
const compact = computed(() => frameWidth.value > 0 && frameWidth.value < 560)

const planRef = toRef(props, 'plan')
const layout = usePressingPlan(planRef, compact)
const { world, editing, snap, dragging, zoneNodes, machineNodes } = layout

watch(editing, value => emit('editingChange', value))

const hovered = ref<string | null>(null)
const announcement = ref('')

const viewport = usePlanViewport(svg, world, {
  canDrag: () => editing.value,
  originOf: layout.originOf,
  startDrag: layout.startDrag,
  dragTo: layout.dragTo,
  endDrag: () => {
    const current = dragging.value

    layout.endDrag()

    if (current)
      announceMove(current.kind, current.id)
  },
})

const { handlers } = viewport

const viewBox = computed(() => `0 0 ${world.value.width} ${world.value.height}`)
const aspect = computed(() => `${world.value.width} / ${world.value.height}`)

/** Pixels écran par unité du plan : décide si capacités et noms restent lisibles. */
const unitPx = computed(() => svgWidth.value / world.value.width * viewport.zoom.value)
const showCapacity = computed(() => unitPx.value * 2.2 >= 7)
const showNames = computed(() => unitPx.value * 2.2 >= 8.5)
const showZoneType = computed(() => unitPx.value * 1.8 >= 8)

const touchAction = computed(() => editing.value || viewport.zoomed.value ? 'none' : 'pan-y')

// --- Libellés ----------------------------------------------------------------------------------

const lower = (text: string) => text.toLowerCase()

function machineLabel(node: MachineNode): string {
  const parts = [node.machine.nom, formatCapacity(node.machine.capacite_kg), lower(STATE_INFO[node.state].label)]

  if (node.zoneName)
    parts.push(`zone ${node.zoneName}`)

  if (!node.placed)
    parts.push('pas encore placée sur le plan')

  return parts.join(', ')
}

function zoneLabel(node: ZoneNode): string {
  const count = machineNodes.value.filter(item => item.machine.zone_id === node.id).length

  return `Zone ${node.zone.nom}, ${lower(ZONE_INFO[node.zone.type].label)}, ${count ? plural(count, 'machine') : 'aucune machine'}`
}

/** Le type n'est répété sous le nom que s'il apporte une information. */
const sameAsType = (node: ZoneNode) => node.zone.nom.trim().toLowerCase() === ZONE_INFO[node.zone.type].label.toLowerCase()

/** Un nom long est tronqué pour rester dans la largeur de sa zone. */
function zoneTitle(node: ZoneNode): string {
  const room = Math.floor((node.w - 8) / (2.6 * 0.56))

  if (room < 3)
    return ''

  return node.zone.nom.length > room ? `${node.zone.nom.slice(0, Math.max(room - 1, 1))}…` : node.zone.nom
}

function machineTitle(node: MachineNode): string {
  const room = Math.floor((node.d * 3.4) / (2.2 * 0.56))

  return node.machine.nom.length > room ? `${node.machine.nom.slice(0, Math.max(room - 1, 1))}…` : node.machine.nom
}

function capacityText(node: MachineNode): string {
  const number = Number(node.machine.capacite_kg)

  return Number.isFinite(number) ? `${number.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg` : ''
}

// --- Sélection ---------------------------------------------------------------------------------

function pickMachine(node: MachineNode) {
  if (editing.value || !viewport.acceptClick())
    return

  hovered.value = null
  emit('selectMachine', node.id)
}

function pickZone(node: ZoneNode) {
  if (editing.value || !viewport.acceptClick())
    return

  hovered.value = null
  emit('selectZone', node.id)
}

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

function onKey(event: KeyboardEvent, kind: 'machine' | 'zone', id: string) {
  if (editing.value && ARROWS[event.key]) {
    event.preventDefault()
    layout.nudge(event.shiftKey && kind === 'zone' ? 'resize' : kind, id, ARROWS[event.key][0], ARROWS[event.key][1])
    announceMove(kind, id)

    return
  }

  if (event.key !== 'Enter' && event.key !== ' ')
    return

  event.preventDefault()

  if (kind === 'machine') {
    const node = machineNodes.value.find(item => item.id === id)

    if (node)
      pickMachine(node)
  }
  else {
    const node = zoneNodes.value.find(item => item.id === id)

    if (node)
      pickZone(node)
  }
}

// --- Annonces pour les lecteurs d'écran ---------------------------------------------------------

function announceMove(kind: DragKind, id: string) {
  if (kind === 'machine') {
    const node = machineNodes.value.find(item => item.id === id)

    if (node)
      announcement.value = `${node.machine.nom} déplacée : ${Math.round(node.point.x)} % de la largeur, ${Math.round(node.point.y)} % de la hauteur.`
  }
  else {
    const node = zoneNodes.value.find(item => item.id === id)

    if (node)
      announcement.value = `Zone ${node.zone.nom} ${kind === 'zone' ? 'déplacée' : 'redimensionnée'} : ${Math.round(node.rect.w)} % sur ${Math.round(node.rect.h)} %.`
  }
}

// Une machine dont l'état change pendant que l'on regarde le plan est annoncée.
watch(() => machineNodes.value.map(node => `${node.id}|${node.state}`).join(','), (_, previous) => {
  if (!previous || editing.value)
    return

  const before = new Map(previous.split(',').filter(Boolean).map(entry => entry.split('|') as [string, MachineState]))

  for (const node of machineNodes.value) {
    const old = before.get(node.id)

    if (old && old !== node.state) {
      announcement.value = `${node.machine.nom} est maintenant ${lower(STATE_INFO[node.state].label)}.`

      return
    }
  }
})

// --- Aménagement -------------------------------------------------------------------------------

function startEditing() {
  layout.begin()
  announcement.value = 'Mode aménagement activé : glissez les zones et les machines, ou utilisez les flèches du clavier.'
}

async function cancelEditing() {
  if (layout.dirtyCount.value > 0 && !(await confirm({
    title: 'Abandonner l\'aménagement ?',
    text: 'Les déplacements non enregistrés seront perdus : le plan retrouvera la mise en page d\'avant.',
    confirmLabel: 'Abandonner',
    cancelLabel: 'Continuer l\'aménagement',
    danger: true,
  })))
    return

  layout.discard()
  announcement.value = 'Aménagement annulé : la mise en page d\'avant est restaurée.'
}

function save() {
  emit('save', {
    zones: layout.zoneChanges.value,
    machines: layout.machineChanges.value.map(change => ({
      id: change.id,
      x: change.point.x,
      y: change.point.y,
      zoneId: layout.zoneContaining(change.point)?.id ?? null,
    })),
  })
}

/** Appelé par la page quand l'enregistrement a réussi : le brouillon est abandonné sans question. */
function finishEditing() {
  layout.discard()
  announcement.value = 'Aménagement enregistré.'
}

defineExpose({ finishEditing })

// --- Infobulle ---------------------------------------------------------------------------------

const tip = computed(() => {
  const node = machineNodes.value.find(item => item.id === hovered.value)

  if (!node || dragging.value || viewport.gesturing.value)
    return null

  const point = viewport.project({ x: node.cx, y: node.cy - node.d / 2 - 2 })
  const { machine } = node
  const details = [STATE_INFO[node.state].label, formatCapacity(machine.capacite_kg)]

  if (node.zoneName)
    details.push(node.zoneName)

  return {
    title: machine.nom,
    kind: CATEGORY_INFO[node.category].label,
    details: details.join(' · '),
    hint: node.placed ? STATE_INFO[node.state].hint : 'Pas encore placée : utilisez « Aménager » pour la poser.',
    left: `${point.x / world.value.width * 100}%`,
    top: `${point.y / world.value.height * 100}%`,
  }
})

function onEnter(event: PointerEvent, id: string) {
  if (event.pointerType !== 'touch' && !editing.value)
    hovered.value = id
}

// --- Légende -----------------------------------------------------------------------------------

const counts = computed(() => {
  const result: Partial<Record<MachineState, number>> = {}

  for (const node of machineNodes.value)
    result[node.state] = (result[node.state] ?? 0) + 1

  return result
})

const legend = computed(() => STATES.map(state => ({ state, ...STATE_INFO[state], count: counts.value[state] ?? 0 })))

const zoomPercent = computed(() => Math.round(viewport.zoom.value * 100))

const subtitle = computed(() => {
  if (editing.value)
    return 'Glissez une zone ou une machine pour la déplacer, tirez le coin d\'une zone pour la redimensionner. Rien n\'est enregistré avant « Enregistrer ».'

  return compact.value ? 'Touchez une machine, pincez pour zoomer.' : 'Touchez une machine ou une zone. Ctrl + molette ou pincement pour zoomer.'
})

const dirty = computed(() => layout.dirtyCount.value)
</script>

<template>
  <VCard class="pressing-plan">
    <VCardItem class="pb-2">
      <VCardTitle>Plan du local</VCardTitle>
      <VCardSubtitle class="text-wrap">
        {{ subtitle }}
      </VCardSubtitle>
      <template
        v-if="canEdit"
        #append
      >
        <VBtn
          v-if="!editing"
          variant="tonal"
          size="small"
          prepend-icon="ri-drag-move-2-line"
          data-tour="plan-edit"
          @click="startEditing"
        >
          Aménager
        </VBtn>
      </template>
    </VCardItem>

    <!-- Barre d'aménagement : visible seulement pendant l'édition. -->
    <div
      v-if="editing"
      class="pressing-plan__toolbar d-flex flex-wrap align-center gap-x-4 gap-y-2 mx-4 mb-3 px-3 py-2"
    >
      <VSwitch
        v-model="snap"
        label="Grille magnétique"
        color="primary"
        density="compact"
        hide-details
        class="flex-grow-0"
      />
      <VBtn
        v-if="layout.unplacedCount.value > 0"
        variant="text"
        size="small"
        prepend-icon="ri-grid-line"
        @click="layout.placeAll"
      >
        {{ layout.unplacedCount.value > 1 ? `Placer les ${layout.unplacedCount.value} machines restantes` : 'Placer la machine restante' }}
      </VBtn>
      <VSpacer />
      <span
        class="text-body-2 text-medium-emphasis"
        aria-live="polite"
      >{{ dirty ? plural(dirty, 'élément modifié', 'éléments modifiés') : 'Aucune modification' }}</span>
      <div class="d-flex gap-2">
        <VBtn
          variant="outlined"
          color="secondary"
          size="small"
          prepend-icon="ri-arrow-go-back-line"
          :disabled="saving"
          @click="cancelEditing"
        >
          Annuler
        </VBtn>
        <VBtn
          size="small"
          prepend-icon="ri-save-line"
          :disabled="!dirty"
          :loading="saving"
          @click="save"
        >
          Enregistrer
        </VBtn>
      </div>
    </div>

    <div
      ref="frame"
      class="pressing-plan__frame"
    >
      <div
        class="pressing-plan__canvas"
        :class="{ 'pressing-plan__canvas--editing': editing, 'pressing-plan__canvas--busy': viewport.gesturing.value }"
        :style="{ aspectRatio: aspect }"
      >
        <svg
          ref="svg"
          class="pressing-plan__svg"
          :viewBox="viewBox"
          :style="{ touchAction }"
          role="group"
          aria-label="Plan du pressing"
          data-tour="plan-canvas"
          @wheel="handlers.onWheel"
          @pointerdown="handlers.onPointerDown"
          @pointermove="handlers.onPointerMove"
          @pointerup="handlers.onPointerUp"
          @pointercancel="handlers.onPointerCancel"
        >
          <defs>
            <pattern
              :id="`grid-${uid}`"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="1"
                cy="1"
                r="0.32"
                class="pressing-plan__dot"
              />
            </pattern>
          </defs>

          <g
            class="pressing-plan__world"
            :class="{ 'pressing-plan__world--smooth': viewport.smooth.value }"
            :transform="viewport.transform.value"
          >
            <rect
              x="0"
              y="0"
              :width="world.width"
              :height="world.height"
              class="pressing-plan__floor"
            />
            <rect
              x="0"
              y="0"
              :width="world.width"
              :height="world.height"
              :fill="`url(#grid-${uid})`"
            />

            <!-- Zones : d'abord, pour que les machines passent par-dessus (et l'ordre de tabulation reste logique). -->
            <g
              v-for="node in zoneNodes"
              :key="node.id"
              class="plan-zone"
              :class="{
                'plan-zone--selected': selectedZoneId === node.id,
                'plan-zone--moving': dragging?.id === node.id,
                'plan-zone--changed': node.moved,
              }"
              :style="{ '--zc': node.zone.couleur }"
              :data-drag-id="node.id"
              data-drag-kind="zone"
              role="button"
              tabindex="0"
              :aria-label="zoneLabel(node)"
              :aria-pressed="selectedZoneId === node.id"
              @click="pickZone(node)"
              @keydown="onKey($event, 'zone', node.id)"
            >
              <rect
                class="plan-zone__area"
                :x="node.x"
                :y="node.y"
                :width="node.w"
                :height="node.h"
                rx="2.2"
              />
              <rect
                class="plan-zone__ring"
                :x="node.x - 0.9"
                :y="node.y - 0.9"
                :width="node.w + 1.8"
                :height="node.h + 1.8"
                rx="3"
              />
              <g
                class="plan-zone__icon"
                :transform="`translate(${node.x + 2.1} ${node.y + 2.1}) scale(0.135)`"
              >
                <path :d="ZONE_ICON_PATH[node.zone.type]" />
              </g>
              <text
                class="plan-zone__title"
                :x="node.x + 6.1"
                :y="node.y + 4.5"
                font-size="2.6"
              >{{ zoneTitle(node) }}</text>
              <text
                v-if="showZoneType && node.h >= 16 && zoneTitle(node) && !sameAsType(node)"
                class="plan-zone__type"
                :x="node.x + 6.1"
                :y="node.y + 7.2"
                font-size="1.8"
              >{{ ZONE_INFO[node.zone.type].label }}</text>

              <!-- Poignée de redimensionnement (mode Aménager). -->
              <g
                v-if="editing"
                class="plan-zone__handle"
                :data-drag-id="node.id"
                data-drag-kind="resize"
                aria-hidden="true"
              >
                <rect
                  :x="node.x + node.w - 6"
                  :y="node.y + node.h - 6"
                  width="6"
                  height="6"
                  fill="transparent"
                />
                <rect
                  :x="node.x + node.w - 3.8"
                  :y="node.y + node.h - 3.8"
                  width="2.8"
                  height="2.8"
                  rx="0.8"
                />
              </g>
            </g>

            <!-- Machines. -->
            <g
              v-for="node in machineNodes"
              :key="node.id"
              class="plan-machine"
              :class="[
                `plan-machine--${node.state}`,
                {
                  'plan-machine--selected': selectedMachineId === node.id,
                  'plan-machine--moving': dragging?.id === node.id,
                  'plan-machine--unplaced': !node.placed,
                  'plan-machine--changed': node.moved,
                },
              ]"
              :style="{ '--c': STATE_INFO[node.state].rgb }"
              :transform="`translate(${node.cx} ${node.cy})`"
              :data-drag-id="node.id"
              data-drag-kind="machine"
              role="button"
              tabindex="0"
              :aria-label="machineLabel(node)"
              :aria-pressed="selectedMachineId === node.id"
              @click="pickMachine(node)"
              @keydown="onKey($event, 'machine', node.id)"
              @pointerenter="onEnter($event, node.id)"
              @pointerleave="hovered = null"
              @focus="hovered = node.id"
              @blur="hovered = null"
            >
              <g class="plan-machine__body">
                <component
                  :is="node.round ? 'circle' : 'rect'"
                  class="plan-machine__ring"
                  v-bind="node.round
                    ? { r: node.d / 2 + 1.6 }
                    : { x: -node.d / 2 - 1.6, y: -node.d / 2 - 1.6, width: node.d + 3.2, height: node.d + 3.2, rx: node.d * 0.2 + 1.2 }"
                />
                <component
                  :is="node.round ? 'circle' : 'rect'"
                  class="plan-machine__shell"
                  v-bind="node.round
                    ? { r: node.d / 2 }
                    : { x: -node.d / 2, y: -node.d / 2, width: node.d, height: node.d, rx: node.d * 0.2 }"
                />

                <!-- Lave-linge : hublot. Sèche-linge : hublot plus petit et bandeau de commandes. -->
                <template v-if="node.round">
                  <circle
                    class="plan-machine__glass"
                    :r="node.d * 0.34"
                  />
                  <circle
                    class="plan-machine__drum"
                    :class="{ 'plan-machine__drum--spin': node.state === 'en_cycle' }"
                    :r="node.d * 0.27"
                  />
                  <circle
                    class="plan-machine__knob"
                    :cy="-node.d * 0.43"
                    :r="node.d * 0.035"
                  />
                </template>
                <template v-else>
                  <rect
                    class="plan-machine__panel"
                    :x="-node.d * 0.3"
                    :y="-node.d * 0.42"
                    :width="node.d * 0.6"
                    :height="node.d * 0.06"
                    rx="0.4"
                  />
                  <circle
                    class="plan-machine__glass"
                    :cy="node.d * 0.06"
                    :r="node.d * 0.28"
                  />
                  <circle
                    class="plan-machine__drum"
                    :class="{ 'plan-machine__drum--spin': node.state === 'en_cycle' }"
                    :cy="node.d * 0.06"
                    :r="node.d * 0.21"
                  />
                </template>

                <text
                  v-if="showCapacity"
                  class="plan-machine__capacity"
                  :y="(node.round ? 0 : node.d * 0.06) + 0.75"
                  :font-size="node.d * 0.19"
                >{{ capacityText(node) }}</text>

                <!-- Pastille d'état « à décharger » / « cycle terminé ». -->
                <g
                  v-if="node.state === 'cycle_termine' || node.state === 'attente_dechargement'"
                  class="plan-machine__badge"
                  :transform="`translate(${node.d * (node.round ? 0.36 : 0.42)} ${-node.d * (node.round ? 0.36 : 0.42)})`"
                >
                  <circle :r="node.d * 0.17" />
                  <path
                    v-if="node.state === 'cycle_termine'"
                    :d="`M ${-node.d * 0.08} 0 L ${-node.d * 0.02} ${node.d * 0.06} L ${node.d * 0.09} ${-node.d * 0.06}`"
                  />
                  <path
                    v-else
                    :d="`M 0 ${-node.d * 0.08} L 0 ${node.d * 0.01} L ${node.d * 0.06} ${node.d * 0.05}`"
                  />
                </g>

                <!-- Hors service : barre oblique. -->
                <line
                  v-if="node.state === 'hors_service'"
                  class="plan-machine__cross"
                  :x1="-node.d * 0.34"
                  :y1="node.d * 0.34"
                  :x2="node.d * 0.34"
                  :y2="-node.d * 0.34"
                />
              </g>

              <text
                v-if="showNames"
                class="plan-machine__name"
                :y="node.d / 2 + 3.4"
                font-size="2.2"
              >{{ machineTitle(node) }}</text>
            </g>
          </g>
        </svg>

        <div
          v-if="tip"
          class="pressing-plan__tip"
          :style="{ left: tip.left, top: tip.top }"
          role="tooltip"
        >
          <div class="font-weight-bold">
            {{ tip.title }} <span class="pressing-plan__tip-kind">{{ tip.kind }}</span>
          </div>
          <div>{{ tip.details }}</div>
          <div class="pressing-plan__tip-hint">
            {{ tip.hint }}
          </div>
        </div>

        <div
          class="pressing-plan__tools"
          role="toolbar"
          aria-label="Zoom du plan"
        >
          <VBtn
            icon="ri-add-line"
            size="small"
            variant="flat"
            color="surface"
            aria-label="Zoomer"
            :disabled="viewport.zoom.value >= MAX_ZOOM - 0.001"
            @click="viewport.zoomIn"
          />
          <VBtn
            icon="ri-subtract-line"
            size="small"
            variant="flat"
            color="surface"
            aria-label="Dézoomer"
            :disabled="!viewport.zoomed.value"
            @click="viewport.zoomOut"
          />
          <VBtn
            icon="ri-focus-3-line"
            size="small"
            variant="flat"
            color="surface"
            aria-label="Recentrer le plan"
            :disabled="!viewport.zoomed.value"
            @click="viewport.reset"
          />
          <span
            class="pressing-plan__zoom text-caption tabular-nums"
            aria-live="polite"
          >{{ zoomPercent }} %</span>
        </div>
      </div>
    </div>

    <!-- Annonces pour les lecteurs d'écran (déplacements, changements d'état). -->
    <div
      class="pressing-plan__sr"
      role="status"
      aria-live="polite"
    >
      {{ announcement }}
    </div>

    <VDivider />

    <ul
      class="pressing-plan__legend"
      aria-label="Légende : nombre de machines par état"
      data-tour="plan-legend"
    >
      <li
        v-for="item in legend"
        :key="item.state"
        class="pressing-plan__legend-item"
        :class="{ 'pressing-plan__legend-item--empty': item.count === 0 }"
      >
        <span
          class="pressing-plan__swatch"
          :style="{ '--c': item.rgb }"
        />
        <span class="text-body-2">{{ item.label }}</span>
        <span class="text-body-2 font-weight-semibold tabular-nums">{{ item.count }}</span>
      </li>
    </ul>
  </VCard>
</template>

<style scoped>
.pressing-plan__toolbar {
  border: 1px dashed rgba(var(--v-theme-primary), 0.55);
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.06);
}

.pressing-plan__frame {
  padding-inline: 16px;
  padding-block-end: 16px;
}

.pressing-plan__canvas {
  position: relative;
  inline-size: 100%;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  user-select: none;
}

.pressing-plan__svg {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  cursor: grab;
  outline: none;
}

.pressing-plan__canvas--busy .pressing-plan__svg {
  cursor: grabbing;
}

.pressing-plan__world--smooth {
  transition: transform 0.25s ease;
}

.pressing-plan__floor {
  fill: rgba(var(--v-theme-on-surface), 0.035);
}

.pressing-plan__dot {
  fill: rgba(var(--v-theme-on-surface), 0.16);
}

/* Zones ------------------------------------------------------------------------------- */

.plan-zone {
  cursor: pointer;
  outline: none;
}

.plan-zone__area {
  fill: var(--zc);
  fill-opacity: 0.11;
  stroke: var(--zc);
  stroke-opacity: 0.6;
  stroke-width: 0.4;
  transition: fill-opacity 0.15s ease;
}

.plan-zone:hover .plan-zone__area {
  fill-opacity: 0.17;
}

.plan-zone__ring {
  fill: none;
  opacity: 0;
  stroke: rgb(var(--v-theme-on-surface));
  stroke-dasharray: 1.6 1.1;
  stroke-width: 0.5;
  transition: opacity 0.15s ease;
}

.plan-zone--selected .plan-zone__ring {
  opacity: 0.85;
}

.plan-zone:focus-visible .plan-zone__ring {
  opacity: 1;
  stroke: rgb(var(--v-theme-primary));
  stroke-dasharray: none;
  stroke-width: 0.7;
}

.plan-zone__icon path {
  fill: var(--zc);
}

.plan-zone__title,
.plan-zone__type {
  fill: rgba(var(--v-theme-on-surface), 0.86);
  font-weight: 700;
  pointer-events: none;
}

.plan-zone__type {
  fill: rgba(var(--v-theme-on-surface), 0.55);
  font-weight: 500;
}

.pressing-plan__canvas--editing .plan-zone {
  cursor: grab;
}

.pressing-plan__canvas--editing .plan-zone__area {
  stroke-dasharray: 1.6 1;
  stroke-opacity: 0.9;
}

.plan-zone--changed .plan-zone__area {
  fill-opacity: 0.2;
}

.plan-zone--moving {
  cursor: grabbing;
}

.plan-zone__handle {
  cursor: nwse-resize;
}

.plan-zone__handle rect:last-child {
  fill: rgb(var(--v-theme-surface));
  stroke: var(--zc);
  stroke-width: 0.5;
}

/* Machines ---------------------------------------------------------------------------- */

.plan-machine {
  cursor: pointer;
  outline: none;
}

.plan-machine__body {
  transition: transform 0.14s ease, filter 0.14s ease, opacity 0.2s ease;
  filter: drop-shadow(0 0.35px 0.5px rgba(0, 0, 0, 0.3));
}

.plan-machine:hover .plan-machine__body,
.plan-machine:focus-visible .plan-machine__body {
  transform: translateY(-0.6px) scale(1.06);
  filter: drop-shadow(0 1.4px 1.6px rgba(0, 0, 0, 0.35));
}

.plan-machine:active .plan-machine__body {
  transform: scale(0.97);
}

.plan-machine__shell {
  fill: rgb(var(--c));
  stroke: rgba(255, 255, 255, 0.6);
  stroke-width: 0.45;
}

.plan-machine__glass {
  fill: rgba(0, 0, 0, 0.22);
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 0.5;
}

.plan-machine__drum {
  fill: rgba(255, 255, 255, 0.2);
  stroke: rgba(255, 255, 255, 0.55);
  stroke-dasharray: 1.2 1.1;
  stroke-width: 0.35;
  transform-box: fill-box;
  transform-origin: center;
}

.plan-machine__drum--spin {
  animation: plan-spin 5s linear infinite;
}

.plan-machine__knob {
  fill: rgba(255, 255, 255, 0.9);
}

.plan-machine__panel {
  fill: rgba(255, 255, 255, 0.75);
}

.plan-machine__capacity {
  fill: #fff;
  font-weight: 700;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.45);
  stroke-linejoin: round;
  stroke-width: 0.5px;
  pointer-events: none;
  text-anchor: middle;
}

.plan-machine__name {
  fill: rgba(var(--v-theme-on-surface), 0.92);
  font-weight: 600;
  paint-order: stroke;
  stroke: rgb(var(--v-theme-surface));
  stroke-linejoin: round;
  stroke-width: 0.9px;
  pointer-events: none;
  text-anchor: middle;
}

.plan-machine__badge circle {
  fill: rgb(var(--v-theme-surface));
  stroke: rgb(var(--c));
  stroke-width: 0.6;
}

.plan-machine__badge path {
  fill: none;
  stroke: rgb(var(--c));
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 0.6;
}

.plan-machine__cross {
  stroke: rgba(255, 255, 255, 0.9);
  stroke-linecap: round;
  stroke-width: 1;
}

.plan-machine--reservee .plan-machine__shell,
.plan-machine--maintenance .plan-machine__shell {
  stroke: rgb(var(--c));
  stroke-dasharray: 1.4 0.9;
  stroke-width: 0.7;
}

.plan-machine--reservee .plan-machine__shell {
  fill: rgba(var(--c), 0.82);
}

.plan-machine--maintenance .plan-machine__shell {
  fill: rgba(var(--c), 0.62);
}

.plan-machine--hors_service .plan-machine__body {
  opacity: 0.6;
}

.plan-machine--unplaced .plan-machine__shell {
  fill-opacity: 0.55;
  stroke: rgb(var(--c));
  stroke-dasharray: 1 0.8;
  stroke-width: 0.6;
}

.plan-machine__ring {
  fill: none;
  opacity: 0;
  stroke: rgb(var(--v-theme-on-surface));
  stroke-dasharray: 1.6 1.1;
  stroke-width: 0.5;
  transition: opacity 0.15s ease;
}

.plan-machine--selected .plan-machine__ring {
  opacity: 0.85;
}

.plan-machine:focus-visible .plan-machine__ring {
  opacity: 1;
  stroke: rgb(var(--v-theme-primary));
  stroke-dasharray: none;
  stroke-width: 0.7;
}

.pressing-plan__canvas--editing .plan-machine {
  cursor: grab;
}

.pressing-plan__canvas--editing .plan-machine__ring {
  opacity: 0.35;
  stroke-dasharray: 0.8 1.2;
  stroke-linecap: round;
}

.plan-machine--changed .plan-machine__ring {
  opacity: 0.9;
  stroke: rgb(var(--v-theme-primary));
}

.plan-machine--moving {
  cursor: grabbing;
}

.plan-machine--moving .plan-machine__body {
  transform: scale(1.1);
  filter: drop-shadow(0 2px 2.2px rgba(0, 0, 0, 0.4));
}

@keyframes plan-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Interface autour du plan ------------------------------------------------------------- */

.pressing-plan__tip {
  position: absolute;
  z-index: 2;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.92);
  color: rgb(var(--v-theme-surface));
  font-size: 0.8125rem;
  line-height: 1.35;
  pointer-events: none;
  transform: translate(-50%, -100%);
  white-space: nowrap;
}

.pressing-plan__tip-kind {
  font-weight: 400;
  opacity: 0.7;
}

.pressing-plan__tip-hint {
  opacity: 0.75;
}

.pressing-plan__tools {
  position: absolute;
  inset-block-end: 10px;
  inset-inline-end: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pressing-plan__tools :deep(.v-btn) {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.pressing-plan__zoom {
  min-inline-size: 3rem;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.pressing-plan__sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.pressing-plan__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
  margin: 0;
  padding: 12px 16px;
  list-style: none;
}

.pressing-plan__legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pressing-plan__legend-item--empty {
  opacity: 0.5;
}

.pressing-plan__swatch {
  display: inline-block;
  inline-size: 14px;
  block-size: 14px;
  border-radius: 50%;
  background: rgb(var(--c));
}

@media (prefers-reduced-motion: reduce) {
  .plan-machine__body,
  .plan-machine__ring,
  .pressing-plan__world--smooth {
    transition: none;
  }

  .plan-machine__drum--spin {
    animation: none;
  }
}
</style>
