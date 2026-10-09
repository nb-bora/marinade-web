<!--
  Plan de salle vu du dessus : chaque table est dessinée à sa place, colorée selon son état
  (libre, occupée, en paiement). Zoom, déplacement du plan, et réorganisation des tables
  (positions mémorisées sur cet appareil).
-->
<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { useFloorPlan } from '../composables/useFloorPlan'
import type { PlanNode } from '../composables/useFloorPlan'
import { MAX_ZOOM, usePlanViewport } from '../composables/usePlanViewport'
import { PLAN_STATE, plural } from '../labels'
import type { PlanState } from '../labels'
import type { TableView } from '../types'
import { useConfirm } from '@/composables/useConfirm'
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
}>()

const emit = defineEmits<{ select: [view: TableView] }>()

const confirm = useConfirm()
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

const editing = ref(false)
const hovered = ref<string | null>(null)

const viewport = usePlanViewport(svg, world, {
  canDragTable: () => editing.value,
  centerOf: id => {
    const node = nodes.value.find(item => item.id === id)

    return node ? { x: node.cx, y: node.cy } : null
  },
  startDrag: plan.startDrag,
  dragTo: plan.dragTo,
  endDrag: plan.endDrag,
})

const { handlers } = viewport

const viewBox = computed(() => `0 0 ${world.value.width} ${world.value.height}`)
const aspect = computed(() => `${world.value.width} / ${world.value.height}`)

/** Pixels par unité du plan, à l'écran : décide si les détails des tables restent lisibles. */
const unitPx = computed(() => svgWidth.value / world.value.width * viewport.zoom.value)

const showDetails = computed(() => unitPx.value * scale.value * 2.1 >= 6.5)

const touchAction = computed(() => editing.value || viewport.zoomed.value ? 'none' : 'pan-y')

/** Un numéro long (E2538, ZZ61970) rétrécit pour rester dans sa table. */
const numberSize = (node: PlanNode) =>
  Math.min(4.6 * scale.value, node.width * 0.88 / (0.62 * Math.max(node.view.table.numero.length, 1)))

// Libellés ---------------------------------------------------------------------------

const money = (amount: number | null) => amount === null ? '' : Math.round(amount).toLocaleString('fr-FR')

function labelOf(node: PlanNode): string {
  const { table, session, covers, total } = node.view
  const parts = [`Table ${table.numero}`, PLAN_STATE[node.state].label.toLowerCase()]

  if (session && covers)
    parts.push(plural(covers, 'couvert'))

  if (session && total !== null)
    parts.push(formatMoney(total))

  return parts.join(', ')
}

function lines(node: PlanNode): string[] {
  const { view, state } = node

  if (state === 'paying')
    return ['Paiement…', money(view.amountDue ?? view.total)].filter(Boolean)

  if (state === 'busy')
    return [view.covers ? `${view.covers} couv.` : '', money(view.total)].filter(Boolean)

  if (state === 'free')
    return [`${view.table.capacite} places`]

  return [PLAN_STATE[state].label]
}

// Interactions -----------------------------------------------------------------------

const isDimmed = (node: PlanNode) => !!props.zone && node.zone !== props.zone

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

async function resetLayout() {
  if (await confirm({
    title: 'Remettre les tables en ordre ?',
    text: 'Les tables retrouvent la disposition automatique. Votre disposition actuelle sera perdue.',
    confirmLabel: 'Remettre en ordre',
  }))
    plan.resetLayout()
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
      details.push(plural(view.covers, 'couvert'))

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
        {{ editing ? 'Glissez les tables : la disposition est gardée sur cet appareil.' : compact ? 'Touchez une table, pincez pour zoomer.' : 'Touchez une table. Ctrl + molette ou pincement pour zoomer.' }}
      </VCardSubtitle>
      <template #append>
        <div class="d-flex align-center gap-2">
          <VBtn
            v-if="editing"
            variant="text"
            size="small"
            prepend-icon="ri-restart-line"
            @click="resetLayout"
          >
            Remettre en ordre
          </VBtn>
          <VBtn
            :variant="editing ? 'flat' : 'tonal'"
            :color="editing ? 'primary' : undefined"
            size="small"
            :prepend-icon="editing ? 'ri-check-line' : 'ri-drag-move-2-line'"
            :aria-pressed="editing"
            @click="editing = !editing"
          >
            {{ editing ? 'Terminer' : 'Réorganiser' }}
          </VBtn>
        </div>
      </template>
    </VCardItem>

    <div
      ref="frame"
      class="floor-plan__frame"
    >
      <div
        class="floor-plan__canvas"
        :class="{ 'floor-plan__canvas--editing': editing, 'floor-plan__canvas--busy': viewport.gesturing.value }"
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
              class="floor-plan__floor"
            />
            <rect
              x="0"
              y="0"
              :width="world.width"
              :height="world.height"
              :fill="`url(#grid-${uid})`"
            />

            <g
              v-for="node in nodes"
              :key="node.id"
              class="floor-table"
              :class="[
                `floor-table--${node.state}`,
                {
                  'floor-table--selected': selectedId === node.id,
                  'floor-table--dim': isDimmed(node),
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

    <ul
      class="floor-plan__legend"
      aria-label="Légende"
    >
      <li
        v-for="item in legend"
        :key="item.state"
        class="d-flex align-center gap-2"
      >
        <span
          class="floor-plan__swatch"
          :style="{ background: `rgb(var(--v-theme-${item.color}))` }"
        />
        <span class="text-body-2">{{ item.label }}</span>
        <span class="text-body-2 text-medium-emphasis tabular-nums">{{ item.count }}</span>
      </li>
    </ul>
  </VCard>
</template>

<style scoped>
.floor-plan__frame {
  padding-inline: 16px;
  padding-block-end: 16px;
}

.floor-plan__canvas {
  position: relative;
  inline-size: 100%;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
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

.floor-plan__floor {
  fill: rgba(var(--v-theme-on-surface), 0.035);
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

.floor-plan__swatch {
  display: inline-block;
  inline-size: 14px;
  block-size: 14px;
  border-radius: 50%;
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
