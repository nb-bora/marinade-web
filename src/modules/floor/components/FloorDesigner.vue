<!--
  Panneau d'aménagement de la salle (propriétaire, gérant) : niveaux, zones du niveau courant, ajout
  de tables en série, et réglages de la table sélectionnée (forme, rotation, niveau, suppression).
  Les déplacements se font directement sur le plan ; tout est enregistré côté serveur.
-->
<script setup lang="ts">
import type { useFloorDesigner } from '../composables/useFloorDesigner'
import type { FloorSnapshot } from '../composables/useFloorData'
import type { LevelDef, PlacementShape, ZoneDef } from '../layout'
import { ZONE_TYPES, levelIdOf, placementOf, zoneOf } from '../layout'
import type { TableView } from '../types'
import LevelFormDialog from './LevelFormDialog.vue'
import TablesBatchDialog from './TablesBatchDialog.vue'
import ZoneFormDialog from './ZoneFormDialog.vue'

const props = defineProps<{
  snapshot: FloorSnapshot
  levelId: string
  selected: TableView | null
  designer: ReturnType<typeof useFloorDesigner>
}>()

defineEmits<{
  'selectLevel': [id: string]
  'editTable': [view: TableView]
  'done': []
}>()

const salle = computed(() => props.snapshot.salle)
const level = computed(() => salle.value.niveaux.find(item => item.id === props.levelId) ?? salle.value.niveaux[0])

const countOnLevel = (id: string) => props.snapshot.views.filter(view => levelIdOf(view.table, salle.value) === id).length
const zonesOfLevel = computed(() => salle.value.zones.filter(zone => zone.niveau === level.value.id))

/** Zones du niveau : celles déclarées, plus celles que des tables utilisent déjà sans les avoir déclarées. */
const zoneRows = computed(() => {
  const counts = new Map<string, number>()

  for (const view of props.snapshot.views.filter(item => levelIdOf(item.table, salle.value) === level.value.id))
    counts.set(zoneOf(view.table), (counts.get(zoneOf(view.table)) ?? 0) + 1)

  const declared = zonesOfLevel.value.map(zone => ({ zone, count: counts.get(zone.nom) ?? 0, declared: true }))

  const implicit = [...counts].filter(([nom]) => !declared.some(row => row.zone.nom.toLowerCase() === nom.toLowerCase()))
    .map(([nom, count]) => ({ zone: { nom, type: 'salle', niveau: level.value.id } as ZoneDef, count, declared: false }))

  return [...declared, ...implicit]
})

const typeOf = (zone: ZoneDef) => ZONE_TYPES.find(item => item.value === zone.type) ?? ZONE_TYPES[0]

// Dialogues ---------------------------------------------------------------------------------

const levelDialog = ref(false)
const editedLevel = ref<LevelDef | null>(null)
const zoneDialog = ref(false)
const editedZone = ref<ZoneDef | null>(null)
const batchDialog = ref(false)

function newLevel() {
  editedLevel.value = null
  levelDialog.value = true
}

function editLevel(item: LevelDef) {
  editedLevel.value = item
  levelDialog.value = true
}

function newZone() {
  editedZone.value = null
  zoneDialog.value = true
}

function editZone(zone: ZoneDef) {
  editedZone.value = zone
  zoneDialog.value = true
}

const saveLevel = (nom: string) => editedLevel.value
  ? props.designer.renameLevelTo(editedLevel.value.id, nom)
  : props.designer.createLevel(nom)

const saveZone = (zone: ZoneDef) => props.designer.saveZone(zone, editedZone.value ?? undefined)

// Table sélectionnée ----------------------------------------------------------------------------

const SHAPES: { value: PlacementShape; title: string }[] = [
  { value: 'round', title: 'Ronde' },
  { value: 'square', title: 'Carrée' },
  { value: 'rect', title: 'Longue' },
]

const selectedPlacement = computed(() => props.selected ? placementOf(props.selected.table) : null)

/** Forme affichée : celle choisie, sinon celle que la capacité donne par défaut. */
const currentShape = computed<PlacementShape>(() => {
  const chosen = selectedPlacement.value?.forme
  const capacity = props.selected?.table.capacite ?? 4

  return chosen ?? (capacity <= 2 ? 'round' : capacity <= 4 ? 'square' : 'rect')
})

function setShape(value: PlacementShape) {
  if (props.selected)
    props.designer.placeTable(props.selected.table, { forme: value })
}

function rotate(delta: number) {
  if (!props.selected)
    return

  const current = selectedPlacement.value?.rot ?? 0

  props.designer.placeTable(props.selected.table, { rot: ((current + delta) % 360 + 360) % 360 })
}

function moveToLevel(id: string) {
  if (props.selected && id !== levelIdOf(props.selected.table, salle.value))
    props.designer.moveToLevel(props.selected.table, id)
}
</script>

<template>
  <VCard
    class="designer"
    data-tour="floor-designer"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          color="primary"
          variant="tonal"
          rounded="lg"
        >
          <VIcon icon="ri-pencil-ruler-2-line" />
        </VAvatar>
      </template>
      <VCardTitle>Aménagement</VCardTitle>
      <VCardSubtitle class="text-wrap">
        Glissez les tables sur le plan : tout s'enregistre.
      </VCardSubtitle>
      <template #append>
        <VBtn
          size="small"
          color="primary"
          prepend-icon="ri-check-line"
          @click="$emit('done')"
        >
          Terminer
        </VBtn>
      </template>
    </VCardItem>

    <!-- Table sélectionnée -->
    <VCardText
      v-if="selected"
      class="designer__selected"
    >
      <div class="d-flex align-center gap-2 mb-3">
        <span class="designer__num">{{ selected.table.numero }}</span>
        <div class="min-w-0">
          <div class="font-weight-medium">
            Table {{ selected.table.numero }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ zoneOf(selected.table) }} · {{ selected.table.capacite }} places
          </div>
        </div>
        <VSpacer />
        <VBtn
          icon="ri-pencil-line"
          size="small"
          variant="text"
          aria-label="Modifier le numéro, les places et la zone"
          @click="$emit('editTable', selected)"
        />
        <VBtn
          icon="ri-delete-bin-line"
          size="small"
          variant="text"
          color="error"
          aria-label="Supprimer la table"
          :disabled="designer.busy.value"
          @click="designer.deleteTable(selected)"
        />
      </div>

      <div class="text-caption text-medium-emphasis mb-1">
        Forme
      </div>
      <AppSegmented
        class="mb-3"
        :model-value="currentShape"
        :options="SHAPES"
        label="Forme de la table"
        @update:model-value="setShape"
      />

      <div class="d-flex flex-wrap align-center gap-2">
        <span class="text-caption text-medium-emphasis">Rotation</span>
        <VBtn
          icon="ri-anticlockwise-2-line"
          size="small"
          variant="tonal"
          aria-label="Tourner de 15 degrés vers la gauche"
          @click="rotate(-15)"
        />
        <span class="text-body-2 tabular-nums designer__deg">{{ selectedPlacement?.rot ?? 0 }}°</span>
        <VBtn
          icon="ri-clockwise-2-line"
          size="small"
          variant="tonal"
          aria-label="Tourner de 15 degrés vers la droite"
          @click="rotate(15)"
        />
      </div>

      <VSelect
        v-if="salle.niveaux.length > 1"
        class="mt-3"
        :model-value="levelIdOf(selected.table, salle)"
        :items="salle.niveaux"
        item-value="id"
        item-title="nom"
        label="Niveau de la table"
        prepend-inner-icon="ri-stack-line"
        density="comfortable"
        hide-details
        @update:model-value="moveToLevel"
      />
    </VCardText>

    <!-- Niveaux -->
    <VCardText class="designer__section">
      <div class="designer__head">
        <span class="designer__title">Niveaux</span>
        <VBtn
          size="x-small"
          variant="tonal"
          prepend-icon="ri-add-line"
          @click="newLevel"
        >
          Ajouter
        </VBtn>
      </div>

      <ul class="designer__list">
        <li
          v-for="(item, index) in salle.niveaux"
          :key="item.id"
          class="designer__row"
          :class="{ 'designer__row--on': item.id === level.id }"
        >
          <button
            type="button"
            class="designer__pick"
            :aria-pressed="item.id === level.id"
            @click="$emit('selectLevel', item.id)"
          >
            <VIcon
              icon="ri-stack-line"
              size="18"
            />
            <span class="designer__label">
              <span class="designer__name">{{ item.nom }}</span>
              <span class="text-caption text-medium-emphasis">{{ countOnLevel(item.id) }} table{{ countOnLevel(item.id) > 1 ? 's' : '' }}</span>
            </span>
          </button>
          <VBtn
            icon="ri-arrow-up-s-line"
            size="x-small"
            variant="text"
            :disabled="index === 0 || designer.busy.value"
            aria-label="Monter le niveau"
            @click="designer.shiftLevel(item.id, -1)"
          />
          <VBtn
            icon="ri-arrow-down-s-line"
            size="x-small"
            variant="text"
            :disabled="index === salle.niveaux.length - 1 || designer.busy.value"
            aria-label="Descendre le niveau"
            @click="designer.shiftLevel(item.id, 1)"
          />
          <VBtn
            icon="ri-pencil-line"
            size="x-small"
            variant="text"
            aria-label="Renommer le niveau"
            @click="editLevel(item)"
          />
          <VBtn
            icon="ri-delete-bin-line"
            size="x-small"
            variant="text"
            color="error"
            :disabled="salle.niveaux.length <= 1 || designer.busy.value"
            aria-label="Supprimer le niveau"
            @click="designer.deleteLevel(item)"
          />
        </li>
      </ul>
    </VCardText>

    <!-- Zones du niveau -->
    <VCardText class="designer__section">
      <div class="designer__head">
        <span class="designer__title">Zones · {{ level.nom }}</span>
        <VBtn
          size="x-small"
          variant="tonal"
          prepend-icon="ri-add-line"
          @click="newZone"
        >
          Ajouter
        </VBtn>
      </div>

      <p
        v-if="!zoneRows.length"
        class="text-body-2 text-medium-emphasis mb-0"
      >
        Aucune zone sur ce niveau. Ajoutez une salle, une terrasse, un bar…
      </p>

      <ul
        v-else
        class="designer__list"
      >
        <li
          v-for="row in zoneRows"
          :key="row.zone.nom"
          class="designer__row"
        >
          <span class="designer__pick designer__pick--static">
            <VIcon
              :icon="typeOf(row.zone).icon"
              size="18"
            />
            <span class="designer__label">
              <span class="designer__name">{{ row.zone.nom }}</span>
              <span class="text-caption text-medium-emphasis">{{ row.count }} table{{ row.count > 1 ? 's' : '' }}</span>
            </span>
          </span>
          <VBtn
            icon="ri-pencil-line"
            size="x-small"
            variant="text"
            aria-label="Modifier la zone"
            @click="editZone(row.zone)"
          />
          <VBtn
            icon="ri-delete-bin-line"
            size="x-small"
            variant="text"
            color="error"
            :disabled="!row.declared || designer.busy.value"
            :title="row.declared ? undefined : 'Cette zone n\'existe que par ses tables : modifiez-la pour la déclarer'"
            aria-label="Supprimer la zone"
            @click="designer.deleteZone(row.zone)"
          />
        </li>
      </ul>
    </VCardText>

    <!-- Tables -->
    <VCardText class="designer__section">
      <div class="designer__head">
        <span class="designer__title">Tables · {{ level.nom }}</span>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          @click="batchDialog = true"
        >
          Ajouter des tables
        </VBtn>
        <VBtn
          variant="tonal"
          prepend-icon="ri-magic-line"
          :disabled="designer.busy.value || !countOnLevel(level.id)"
          @click="designer.autoLayout(level.id)"
        >
          Ranger automatiquement
        </VBtn>
      </div>
    </VCardText>

    <LevelFormDialog
      v-model="levelDialog"
      :level="editedLevel"
      :save="saveLevel"
    />
    <ZoneFormDialog
      v-model="zoneDialog"
      :zone="editedZone"
      :levels="salle.niveaux"
      :default-level="level.id"
      :save="saveZone"
    />
    <TablesBatchDialog
      v-model="batchDialog"
      :levels="[level]"
      :default-level="level.id"
      :zones-of="() => zoneRows.map(row => row.zone.nom)"
      :existing="snapshot.views.map(view => view.table.numero)"
      :save="(levelId, spec) => designer.createTables(levelId, spec)"
    />
  </VCard>
</template>

<style scoped lang="scss">
/* Sur grand écran le panneau reste à côté du plan et défile seul ; sur téléphone il s'étend sous le plan. */
@media (min-width: 1280px) {
  .designer {
    max-block-size: calc(100vh - 110px);
    overflow-y: auto;
  }
}

.designer__selected {
  background: rgba(var(--v-theme-primary), 0.06);
  border-block: 1px solid rgba(var(--v-theme-primary), 0.2);
}

.designer__num {
  align-items: center;
  background: rgb(var(--v-theme-primary));
  border-radius: 10px;
  color: #fff;
  display: inline-flex;
  font-weight: 700;
  justify-content: center;
  min-inline-size: 44px;
  padding: 0.5rem;
}

.designer__deg {
  inline-size: 3rem;
  text-align: center;
}

.designer__section {
  border-block-start: 1px solid rgba(var(--v-border-color), 0.12);
  padding-block: 0.9rem;
}

.designer__head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-block-end: 0.5rem;
}

.designer__title {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.designer__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.designer__row {
  align-items: center;
  border-radius: 10px;
  display: flex;
  gap: 2px;

  &--on {
    background: rgba(var(--v-theme-primary), 0.1);
  }
}

.designer__pick {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 10px;
  color: inherit;
  cursor: pointer;
  display: flex;
  flex: 1;
  font: inherit;
  gap: 0.5rem;
  min-inline-size: 0;
  padding: 0.45rem 0.5rem;
  text-align: start;

  &:hover:not(.designer__pick--static) {
    background: rgba(var(--v-theme-on-surface), 0.05);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: -2px;
  }

  &--static {
    cursor: default;
  }
}

.designer__label {
  display: flex;
  flex: 1;
  flex-direction: column;
  line-height: 1.25;
  min-inline-size: 0;
}

.designer__name {
  flex: 1;
  font-weight: 600;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
