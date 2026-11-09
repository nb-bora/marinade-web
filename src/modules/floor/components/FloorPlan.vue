<!--
  Plan de salle vu du dessus : chaque table est dessinée à sa place, colorée selon son état
  (libre, occupée, en paiement). Zoom, déplacement du plan, et réorganisation des tables
  (positions mémorisées sur cet appareil).
-->
<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { compactMoney, elapsedTone, formatElapsed, minutesSince } from '../composables/useFloorMetrics'
import { freeSeats, seatsLabel } from '../layout'
import { useFloorPlan } from '../composables/useFloorPlan'
import type { PlanNode } from '../composables/useFloorPlan'
import { MAX_ZOOM, usePlanViewport } from '../composables/usePlanViewport'
import { PLAN_STATE, plural } from '../labels'
import type { PlanState } from '../labels'
import type { TableView } from '../types'
import FloorStatePills from './FloorStatePills.vue'
import { formatMoney, formatRelative } from '@/lib/format'

const props = defineProps<{
  views: TableView[]
  now: Date

  /** Table sélectionnée (anneau de sélection). */
  selectedId?: string | null

  /** Zone à mettre en avant ; les autres tables sont estompées. `null` : toutes. */
  zone?: string | null

  /** Tables dont l'état vient de changer : `in` (prise), `out` (libérée). */
  flashes?: Record<string, 'in' | 'out'>

  /** Mode aménagement : les tables se déplacent (à la souris ou au doigt) et le déplacement est signalé par `move`. */
  editable?: boolean
}>()

const emit = defineEmits<{
  select: [view: TableView]

  /** Une table a été déplacée : nouvelle position en % du plan. */
  move: [point: { id: string; x: number; y: number }]
}>()

const uid = useId()

const frame = ref<HTMLElement | null>(null)
const svg = ref<SVGSVGElement | null>(null)

const { width: frameWidth } = useElementSize(frame)
const { width: svgWidth } = useElementSize(svg)

/** Sur téléphone le plan est plus haut que large (4/3) pour garder des tables lisibles. */
const compact = computed(() => frameWidth.value > 0 && frameWidth.value < 560)

const views = toRef(props, 'views')
const plan = useFloorPlan(views, compact)
const { nodes, world, scale, dragging } = plan

const hovered = ref<string | null>(null)

const viewport = usePlanViewport(svg, world, {
  canDragTable: () => !!props.editable,
  centerOf: id => {
    const node = nodes.value.find(item => item.id === id)

    return node ? { x: node.cx, y: node.cy } : null
  },
  startDrag: plan.startDrag,
  dragTo: plan.dragTo,
  endDrag: () => {
    const moved = plan.endDrag()

    if (moved)
      emit('move', moved)
  },
})

const { handlers } = viewport

const viewBox = computed(() => `0 0 ${world.value.width} ${world.value.height}`)
const aspect = computed(() => `${world.value.width} / ${world.value.height}`)

/** Pixels par unité du plan, à l'écran : décide si les détails des tables restent lisibles. */
const unitPx = computed(() => svgWidth.value / world.value.width * viewport.zoom.value)

const showDetails = computed(() => unitPx.value * scale.value * 2.1 >= 6.5)

const touchAction = computed(() => props.editable || viewport.zoomed.value ? 'none' : 'pan-y')

/** Un numéro long (E2538, ZZ61970) rétrécit pour rester dans sa table. */
const numberSize = (node: PlanNode) =>
  Math.min(4.6 * scale.value, node.width * 0.88 / (0.62 * Math.max(node.view.table.numero.length, 1)))

// Libellés ---------------------------------------------------------------------------

const money = compactMoney

function labelOf(node: PlanNode): string {
  const { table, session, covers, total } = node.view
  const parts = [`Table ${table.numero}`, PLAN_STATE[node.state].label.toLowerCase()]

  if (session)
    parts.push(covers ? `${plural(covers, 'couvert')}, ${seatsLabel(node.view)}` : seatsLabel(node.view))

  if (session && total !== null)
    parts.push(formatMoney(total))

  return parts.join(', ')
}

/** « 2 libres » / « complète » : les places restantes d'une table servie, toujours visibles sur le plan. */
function seatShort(node: PlanNode): string {
  const { view } = node

  if (view.covers === null)
    return `${view.table.capacite} places`

  const free = freeSeats(view)

  return free === 0 ? 'complète' : `${free} libre${free > 1 ? 's' : ''}`
}

function lines(node: PlanNode): string[] {
  const { view, state } = node

  if (state === 'paying')
    return ['Paiement…', money(view.amountDue ?? view.total)].filter(Boolean)

  if (state === 'busy')
    return [seatShort(node), money(view.total)].filter(Boolean)

  if (state === 'free')
    return [`${view.table.capacite} places`]

  return [PLAN_STATE[state].label]
}

/** Pastille de durée en haut à droite d'une table occupée : calme, à surveiller, trop longue. */
function badgeOf(node: PlanNode): { text: string; tone: string; x: number; y: number; w: number } | null {
  const { session } = node.view

  if (!session || (node.state !== 'busy' && node.state !== 'paying'))
    return null

  const minutes = minutesSince(session.opened_at, props.now)
  const text = formatElapsed(minutes)
  const w = (text.length * 1.15 + 2.2) * scale.value

  return { text, tone: elapsedTone(minutes), x: node.width / 2 - w * 0.62, y: -node.height / 2 - 1.1 * scale.value, w }
}

// Zones : un cadre discret autour des tables d'une même zone, avec son nom --------------------

interface ZoneBox { name: string; x: number; y: number; width: number; height: number }

const zones = computed<ZoneBox[]>(() => {
  const groups = new Map<string, PlanNode[]>()

  for (const node of nodes.value)
    groups.set(node.zone, [...(groups.get(node.zone) ?? []), node])

  // Une seule zone : le cadre n'apprendrait rien.
  if (groups.size < 2)
    return []

  const k = scale.value
  const chair = 1.45 * k

  return [...groups].map(([name, list]) => {
    // Le cadre épouse les tables ET leurs chaises, avec une marge fine.
    const left = (n: PlanNode) => Math.min(n.cx - n.width / 2, ...n.chairs.map(c => n.cx + c.x - chair))
    const right = (n: PlanNode) => Math.max(n.cx + n.width / 2, ...n.chairs.map(c => n.cx + c.x + chair))
    const top = (n: PlanNode) => Math.min(n.cy - n.height / 2, ...n.chairs.map(c => n.cy + c.y - chair))
    const bottom = (n: PlanNode) => Math.max(n.cy + n.height / 2, ...n.chairs.map(c => n.cy + c.y + chair))

    const x1 = Math.max(0.8, Math.min(...list.map(left)) - 2 * k)
    const y1 = Math.max(0.8, Math.min(...list.map(top)) - 1.8 * k)
    const x2 = Math.min(world.value.width - 0.8, Math.max(...list.map(right)) + 2 * k)
    const y2 = Math.min(world.value.height - 0.8, Math.max(...list.map(bottom)) + 1.8 * k)

    return { name, x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
  })
})

// Interactions -----------------------------------------------------------------------

const isDimmed = (node: PlanNode) => !!props.zone && node.zone !== props.zone

/** Filtre posé depuis la légende : les autres états s'estompent mais restent cliquables. */
const stateFilter = ref<PlanState | null>(null)
const isMuted = (node: PlanNode) => !!stateFilter.value && node.state !== stateFilter.value

function select(node: PlanNode) {
  if (isDimmed(node) || !viewport.acceptClick())
    return

  hovered.value = null
  emit('select', node.view)
}

function onKey(event: KeyboardEvent, node: PlanNode) {
  if (event.key !== 'Enter' && event.key !== ' ')
    return

  event.preventDefault()
  emit('select', node.view)
}

// Infobulle (souris et clavier) --------------------------------------------------------

const tip = computed(() => {
  const node = nodes.value.find(item => item.id === hovered.value)

  if (!node || dragging.value || viewport.gesturing.value)
    return null

  const { view, state } = node
  const point = viewport.project({ x: node.cx, y: node.cy - node.height / 2 - 3 })
  const details = [PLAN_STATE[state].label]

  if (view.session) {
    if (view.covers)
      details.push(`${plural(view.covers, 'couvert')} sur ${view.table.capacite}`)

    details.push(seatsLabel(view))

    if (view.total !== null)
      details.push(formatMoney(view.total))

    details.push(`depuis ${formatRelative(view.session.opened_at, props.now).replace(/^il y a /, '')}`)
  }
  else {
    details.push(plural(view.table.capacite, 'place'))
  }

  return {
    title: `Table ${view.table.numero}`,
    details: details.join(' · '),
    hint: PLAN_STATE[state].hint,
    left: `${point.x / world.value.width * 100}%`,
    top: `${point.y / world.value.height * 100}%`,
  }
})

function onEnter(event: PointerEvent, node: PlanNode) {
  if (event.pointerType !== 'touch' && !isDimmed(node))
    hovered.value = node.id
}

// Légende ----------------------------------------------------------------------------

const LEGEND: PlanState[] = ['free', 'busy', 'paying']

const counts = computed(() => {
  const result: Record<string, number> = {}

  for (const node of nodes.value)
    result[node.state] = (result[node.state] ?? 0) + 1

  return result
})

const legend = computed(() => {
  const extra = (['reserved', 'settled', 'maintenance'] as PlanState[]).filter(state => counts.value[state])

  return [...LEGEND, ...extra].map(state => ({ state, ...PLAN_STATE[state], count: counts.value[state] ?? 0 }))
})

const zoomPercent = computed(() => Math.round(viewport.zoom.value * 100))
</script>

<template>
  <VCard class="floor-plan">
    <VCardItem class="pb-2">
      <VCardTitle>Salle</VCardTitle>
      <VCardSubtitle class="text-wrap">
        {{ editable ? 'Glissez les tables pour les placer : chaque déplacement est enregistré.' : compact ? 'Touchez une table, pincez pour zoomer.' : 'Touchez une table. Ctrl + molette ou pincement pour zoomer.' }}
      </VCardSubtitle>
    </VCardItem>

    <div
      ref="frame"
      class="floor-plan__frame"
    >
      <div
        class="floor-plan__canvas"
        :class="{ 'floor-plan__canvas--editing': editable, 'floor-plan__canvas--busy': viewport.gesturing.value }"
        :style="{ aspectRatio: aspect }"
      >
        <svg
          ref="svg"
          class="floor-plan__svg"
          :viewBox="viewBox"
          :style="{ touchAction }"
          role="group"
          aria-label="Plan de la salle"
          @wheel="handlers.onWheel"
          @pointerdown="handlers.onPointerDown"
          @pointermove="handlers.onPointerMove"
          @pointerup="handlers.onPointerUp"
          @pointercancel="handlers.onPointerCancel"
        >
          <defs>
            <radialGradient
              :id="`floor-${uid}`"
              cx="50%"
              cy="45%"
              r="75%"
            >
              <stop
                offset="0%"
                stop-color="rgb(var(--v-theme-on-surface))"
                stop-opacity="0.02"
              />
              <stop
                offset="100%"
                stop-color="rgb(var(--v-theme-on-surface))"
                stop-opacity="0.08"
              />
            </radialGradient>
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
                class="floor-plan__dot"
              />
            </pattern>
          </defs>

          <g
            class="floor-plan__world"
            :class="{ 'floor-plan__world--smooth': viewport.smooth.value }"
            :transform="viewport.transform.value"
          >
            <rect
              x="0"
              y="0"
              :width="world.width"
              :height="world.height"
              :fill="`url(#floor-${uid})`"
            />
            <rect
              x="0"
              y="0"
              :width="world.width"
              :height="world.height"
              :fill="`url(#grid-${uid})`"
            />

            <g
              v-for="box in zones"
              :key="`zone-${box.name}`"
              class="floor-zone"
              :class="{ 'floor-zone--active': box.name === props.zone }"
              aria-hidden="true"
            >
              <rect
                :x="box.x"
                :y="box.y"
                :width="box.width"
                :height="box.height"
                rx="3.5"
                class="floor-zone__box"
              />
              <rect
                :x="box.x + 2.4"
                :y="box.y - 1.9"
                :width="box.name.length * 1.75 + 3.6"
                height="3.8"
                rx="1.9"
                class="floor-zone__pill"
              />
              <text
                :x="box.x + 4.2"
                :y="box.y + 0.75"
                class="floor-zone__label"
              >{{ box.name }}</text>
            </g>

            <g
              v-for="node in nodes"
              :key="node.id"
              class="floor-table"
              :class="[
                `floor-table--${node.state}`,
                {
                  'floor-table--selected': selectedId === node.id,
                  'floor-table--dim': isDimmed(node),
                  'floor-table--muted': isMuted(node),
                  'floor-table--moving': dragging?.id === node.id,
                  [`floor-table--flash-${flashes?.[node.id]}`]: !!flashes?.[node.id],
                },
              ]"
              :style="{ '--c': `var(--v-theme-${PLAN_STATE[node.state].color})` }"
              :transform="`translate(${node.cx} ${node.cy})`"
              :data-table-id="node.id"
              role="button"
              :tabindex="isDimmed(node) ? -1 : 0"
              :aria-label="labelOf(node)"
              :aria-pressed="selectedId === node.id"
              @click="select(node)"
              @keydown="onKey($event, node)"
              @pointerenter="onEnter($event, node)"
              @pointerleave="hovered = null"
              @focus="hovered = node.id"
              @blur="hovered = null"
            >
              <g class="floor-table__body">
                <!-- Anneau d'animation (nouvelle occupation / libération) et de sélection. -->
                <component
                  :is="node.shape === 'round' ? 'circle' : 'rect'"
                  v-if="flashes?.[node.id]"
                  :key="`flash-${flashes[node.id]}`"
                  class="floor-table__pulse"
                  v-bind="node.shape === 'round'
                    ? { r: node.width / 2 }
                    : { x: -node.width / 2, y: -node.height / 2, width: node.width, height: node.height, rx: 2.2 }"
                />
                <component
                  :is="node.shape === 'round' ? 'circle' : 'rect'"
                  class="floor-table__ring"
                  v-bind="node.shape === 'round'
                    ? { r: node.width / 2 + 1.6 }
                    : { x: -node.width / 2 - 1.6, y: -node.height / 2 - 1.6, width: node.width + 3.2, height: node.height + 3.2, rx: 3.6 }"
                />

                <g :transform="node.rot ? `rotate(${node.rot})` : undefined">
                  <circle
                    v-for="(chair, index) in node.chairs"
                    :key="index"
                    :cx="chair.x"
                    :cy="chair.y"
                    :r="1.45 * scale"
                    class="floor-table__chair"
                    :class="{ 'floor-table__chair--taken': chair.taken }"
                  />

                  <component
                    :is="node.shape === 'round' ? 'circle' : 'rect'"
                    class="floor-table__top"
                    v-bind="node.shape === 'round'
                      ? { r: node.width / 2 }
                      : { x: -node.width / 2, y: -node.height / 2, width: node.width, height: node.height, rx: 2.2 }"
                  />
                </g>

                <text
                  class="floor-table__number"
                  :y="showDetails ? -0.6 * scale : 1.5 * scale"
                  :font-size="numberSize(node)"
                >{{ node.view.table.numero }}</text>
                <template v-if="showDetails">
                  <text
                    v-for="(line, index) in lines(node)"
                    :key="index"
                    class="floor-table__line"
                    :y="(2.5 + index * 2.4) * scale"
                    :font-size="2.1 * scale"
                  >{{ line }}</text>
                </template>
                <g
                  v-if="showDetails && badgeOf(node)"
                  class="floor-badge"
                  :class="`floor-badge--${badgeOf(node)!.tone}`"
                  :transform="`translate(${badgeOf(node)!.x} ${badgeOf(node)!.y})`"
                >
                  <rect
                    :width="badgeOf(node)!.w"
                    :height="3.1 * scale"
                    :rx="1.55 * scale"
                    class="floor-badge__bg"
                  />
                  <text
                    :x="badgeOf(node)!.w / 2"
                    :y="2.2 * scale"
                    :font-size="1.75 * scale"
                    class="floor-badge__text"
                  >{{ badgeOf(node)!.text }}</text>
                </g>
              </g>
            </g>
          </g>
        </svg>

        <div
          v-if="tip"
          class="floor-plan__tip"
          :style="{ left: tip.left, top: tip.top }"
          role="tooltip"
        >
          <div class="font-weight-bold">
            {{ tip.title }}
          </div>
          <div>{{ tip.details }}</div>
          <div class="floor-plan__tip-hint">
            {{ tip.hint }}
          </div>
        </div>

        <div
          class="floor-plan__tools"
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
            class="floor-plan__zoom text-caption tabular-nums"
            aria-live="polite"
          >{{ zoomPercent }} %</span>
        </div>
      </div>
    </div>

    <VDivider />

    <FloorStatePills
      v-model="stateFilter"
      class="floor-plan__legend"
      :items="legend"
      label="Légende, touchez un état pour mettre ces tables en évidence"
    />
  </VCard>
</template>

<style scoped lang="scss">
.floor-plan__frame {
  padding-inline: 16px;
  padding-block-end: 16px;
}

.floor-plan__canvas {
  position: relative;
  inline-size: 100%;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 14px;
  user-select: none;
}

.floor-plan__svg {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  cursor: grab;
  outline: none;
}

.floor-plan__canvas--busy .floor-plan__svg {
  cursor: grabbing;
}

.floor-plan__world--smooth {
  transition: transform 0.25s ease;
}

.floor-zone {
  pointer-events: none;
}

.floor-zone__box {
  fill: rgba(var(--v-theme-primary), 0.035);
  stroke: rgba(var(--v-theme-on-surface), 0.22);
  stroke-dasharray: 1.6 1.2;
  stroke-width: 0.35;
}

.floor-zone__pill {
  fill: rgb(var(--v-theme-surface));
  stroke: rgba(var(--v-theme-on-surface), 0.22);
  stroke-width: 0.3;
}

.floor-zone__label {
  fill: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 2.1px;
  font-weight: 700;
  letter-spacing: 0.18px;
  text-transform: uppercase;
}

.floor-zone--active .floor-zone__box {
  fill: rgba(var(--v-theme-primary), 0.08);
  stroke: rgb(var(--v-theme-primary));
  stroke-dasharray: none;
  stroke-width: 0.5;
}

.floor-zone--active .floor-zone__label {
  fill: rgb(var(--v-theme-primary));
}

.floor-table--muted {
  opacity: 0.28;
}

.floor-badge {
  pointer-events: none;
}

.floor-badge__bg {
  fill: rgb(var(--v-theme-surface));
  stroke: rgba(var(--v-theme-on-surface), 0.3);
  stroke-width: 0.25;
}

.floor-badge__text {
  fill: rgb(var(--v-theme-on-surface));
  font-weight: 700;
  text-anchor: middle;
}

.floor-badge--warn .floor-badge__bg {
  fill: rgb(var(--v-theme-warning));
  stroke: none;
}

.floor-badge--late .floor-badge__bg {
  fill: rgb(var(--v-theme-error));
  stroke: none;
}

.floor-badge--warn .floor-badge__text,
.floor-badge--late .floor-badge__text {
  fill: #fff;
}

.floor-plan__dot {
  fill: rgba(var(--v-theme-on-surface), 0.16);
}

/* Table ------------------------------------------------------------------------------- */

.floor-table {
  cursor: pointer;
  outline: none;
  transition: opacity 0.2s ease;
}

.floor-table__body {
  transition: transform 0.14s ease, filter 0.14s ease;
  filter: drop-shadow(0 0.35px 0.5px rgba(0, 0, 0, 0.28));
}

.floor-table:hover .floor-table__body,
.floor-table:focus-visible .floor-table__body {
  transform: translateY(-0.7px) scale(1.06);
  filter: drop-shadow(0 1.4px 1.6px rgba(0, 0, 0, 0.35));
}

.floor-table:active .floor-table__body {
  transform: scale(0.97);
}

.floor-table__top {
  fill: rgb(var(--c));
  stroke: rgba(255, 255, 255, 0.55);
  stroke-width: 0.45;
}

.floor-table--free .floor-table__top {
  fill: rgba(var(--c), 0.92);
}

.floor-table--reserved .floor-table__top,
.floor-table--settled .floor-table__top,
.floor-table--maintenance .floor-table__top {
  stroke: rgb(var(--c));
  stroke-dasharray: 1.4 0.9;
  stroke-width: 0.6;
}

.floor-table--reserved .floor-table__top,
.floor-table--settled .floor-table__top {
  fill: rgba(var(--c), 0.82);
}

.floor-table--maintenance .floor-table__top {
  fill: rgba(var(--c), 0.45);
}

.floor-table__chair {
  fill: rgba(var(--v-theme-on-surface), 0.26);
}

.floor-table__chair--taken {
  fill: rgb(var(--c));
  stroke: rgba(255, 255, 255, 0.6);
  stroke-width: 0.25;
}

.floor-table__number,
.floor-table__line {
  fill: #fff;
  font-weight: 700;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.28);
  stroke-linejoin: round;
  stroke-width: 0.35px;
  pointer-events: none;
  text-anchor: middle;
}

.floor-table__line {
  font-weight: 600;
  opacity: 0.95;
}

.floor-table__ring {
  fill: none;
  opacity: 0;
  stroke: rgb(var(--v-theme-on-surface));
  stroke-dasharray: 1.6 1.1;
  stroke-width: 0.5;
  transition: opacity 0.15s ease;
}

.floor-table--selected .floor-table__ring {
  opacity: 0.85;
}

.floor-table:focus-visible .floor-table__ring {
  opacity: 1;
  stroke: rgb(var(--v-theme-primary));
  stroke-dasharray: none;
  stroke-width: 0.7;
}

.floor-table--dim {
  cursor: default;
  opacity: 0.2;
  pointer-events: none;
}

.floor-plan__canvas--editing .floor-table {
  cursor: grab;
}

.floor-plan__canvas--editing .floor-table__ring {
  opacity: 0.5;
}

.floor-table--moving {
  cursor: grabbing;
}

.floor-table--moving .floor-table__body {
  transform: scale(1.1);
  filter: drop-shadow(0 2px 2.2px rgba(0, 0, 0, 0.4));
}

/* Animations temps réel : une onde et un petit rebond. */
.floor-table__pulse {
  fill: none;
  stroke: rgb(var(--c));
  stroke-width: 0.8;
  opacity: 0;
  pointer-events: none;
  transform-box: fill-box;
  transform-origin: center;
}

.floor-table--flash-in .floor-table__pulse {
  animation: floor-wave-out 0.6s ease-out 2;
}

.floor-table--flash-out .floor-table__pulse {
  animation: floor-wave-in 1.2s ease-in;
}

.floor-table--flash-in .floor-table__top {
  animation: floor-pop 0.6s ease-out 2;
}

.floor-table--flash-out .floor-table__top {
  animation: floor-settle 1.2s ease-out;
}

.floor-table__top {
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes floor-wave-out {
  from {
    opacity: 0.9;
    transform: scale(1);
  }

  to {
    opacity: 0;
    transform: scale(1.9);
  }
}

@keyframes floor-wave-in {
  from {
    opacity: 0;
    transform: scale(1.9);
  }

  60% {
    opacity: 0.9;
  }

  to {
    opacity: 0;
    transform: scale(1);
  }
}

@keyframes floor-pop {
  50% {
    transform: scale(1.12);
  }
}

@keyframes floor-settle {
  from {
    transform: scale(0.88);
  }

  to {
    transform: scale(1);
  }
}

/* Interface autour du plan ------------------------------------------------------------- */

.floor-plan__tip {
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

.floor-plan__tip-hint {
  opacity: 0.75;
}

.floor-plan__tools {
  position: absolute;
  inset-block-end: 10px;
  inset-inline-end: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.floor-plan__tools :deep(.v-btn) {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.floor-plan__zoom {
  min-inline-size: 3rem;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.floor-plan__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 0;
  padding: 12px 16px;
  list-style: none;
}

@media (prefers-reduced-motion: reduce) {
  .floor-table,
  .floor-table__body,
  .floor-table__ring,
  .floor-plan__world--smooth {
    transition: none;
  }

  .floor-table--flash-in .floor-table__pulse,
  .floor-table--flash-out .floor-table__pulse,
  .floor-table--flash-in .floor-table__top,
  .floor-table--flash-out .floor-table__top {
    animation: none;
  }

  /* Sans mouvement, l'anneau reste simplement visible pendant la durée du signal. */
  .floor-table--flash-in .floor-table__pulse,
  .floor-table--flash-out .floor-table__pulse {
    opacity: 0.9;
  }
}
</style>
