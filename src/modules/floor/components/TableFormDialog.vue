<!--
  Créer ou modifier une table : numéro, places, zone, niveau, forme et statut. Une nouvelle table se pose
  sur la première place libre du niveau choisi ; changer une table de niveau la déplace de même. Le
  service (équipe en salle) ne change que le statut ; le reste est réservé à la gestion.
-->
<script setup lang="ts">
import { floorApi } from '../api'
import type { useFloorDesigner } from '../composables/useFloorDesigner'
import { TABLE_STATUS_OPTIONS, tableStatusOf } from '../labels'
import type { PlacementShape, SalleConfig } from '../layout'
import { buildAttributes, formeOf, levelIdOf } from '../layout'
import type { Table, TableUpdate } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { isApiError } from '@/lib/http/errors'
import { required } from '@/lib/validation'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{

  /** La table à modifier ; `null` pour en créer une. */
  table: Table | null

  /** Zones déjà utilisées, proposées à la saisie. */
  locations: string[]

  /** Niveaux de la salle. */
  salle: SalleConfig

  /** Seules actions d'aménagement utilisées ici (`addTable`, `relocateTable`). */
  designer: Pick<ReturnType<typeof useFloorDesigner>, 'addTable' | 'relocateTable'>

  /** Niveau proposé pour une nouvelle table. */
  defaultLevel?: string

  /** Seul le management peut changer le numéro, les places, la zone, le niveau et la forme ; le service ne change que le statut. */
  canEditLayout: boolean
}>()

const emit = defineEmits<{ saved: [table: Table] }>()

const open = defineModel<boolean>({ required: true })

const toast = useToast()

type Shape = PlacementShape | 'auto'

const SHAPES: { value: Shape; title: string }[] = [
  { value: 'auto', title: 'Auto' },
  { value: 'round', title: 'Ronde' },
  { value: 'square', title: 'Carrée' },
  { value: 'rect', title: 'Longue' },
]

const numero = ref('')
const capacite = ref<number | string>(4)
const emplacement = ref<string | null>(null)
const statut = ref('libre')
const level = ref('')
const shape = ref<Shape>('auto')

const isEdit = computed(() => props.table !== null)
const initialLevel = computed(() => props.table ? levelIdOf(props.table, props.salle) : props.defaultLevel ?? props.salle.niveaux[0].id)
const initialShape = computed<Shape>(() => (props.table ? formeOf(props.table) : undefined) ?? 'auto')
const levelName = computed(() => props.salle.niveaux.find(item => item.id === level.value)?.nom ?? '')

const { submit, pending, error, message, reset } = useSubmit(async () => {
  const body = {
    numero: numero.value.trim(),
    capacite: Number(capacite.value),
    emplacement: emplacement.value?.trim() || null,
    statut: statut.value,
  }

  let saved: Table

  if (props.table) {
    const patch: TableUpdate = props.canEditLayout ? { ...body } : { statut: statut.value }

    if (props.canEditLayout && shape.value !== initialShape.value)
      patch.attributs_jsonb = buildAttributes(props.table.attributs_jsonb, { forme: shape.value === 'auto' ? null : shape.value })

    saved = await floorApi.updateTable(props.table.id, patch)

    if (props.canEditLayout && level.value !== initialLevel.value)
      saved = await props.designer.relocateTable(saved, level.value)
  }
  else {
    saved = await props.designer.addTable(level.value, {
      numero: body.numero,
      capacity: body.capacite,
      zone: body.emplacement,
      statut: body.statut,
      shape: shape.value === 'auto' ? undefined : shape.value,
    })
  }

  toast.success(isEdit.value ? `Table ${saved.numero} mise à jour.` : `Table ${saved.numero} créée.`)
  open.value = false
  emit('saved', saved)
})

watch(open, isOpen => {
  if (!isOpen)
    return

  numero.value = props.table?.numero ?? ''
  capacite.value = props.table?.capacite ?? 4
  emplacement.value = props.table?.emplacement ?? null
  statut.value = props.table ? tableStatusOf(props.table.statut) : 'libre'
  level.value = initialLevel.value
  shape.value = initialShape.value
  reset()
})

// Un numéro déjà pris revient en 400 : on le dit plutôt qu'un message générique.
const errorText = computed(() => {
  if (isApiError(error.value) && error.value.kind === 'client')
    return 'Cette table n\'a pas pu être enregistrée : ce numéro est peut-être déjà utilisé.'

  return message.value
})

const positiveInteger = (value: unknown) => (Number.isInteger(Number(value)) && Number(value) > 0) || 'Saisissez un nombre entier supérieur à zéro.'
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? `Modifier la table ${table?.numero}` : 'Nouvelle table'"
    :subtitle="isEdit ? undefined : `Elle se pose sur la première place libre${salle.niveaux.length > 1 ? ` du niveau « ${levelName} »` : ' du plan'}.`"
    icon="ri-layout-grid-line"
    :submit-label="isEdit ? 'Enregistrer' : 'Créer'"
    :loading="pending"
    :error="errorText"
    @submit="submit"
  >
    <VRow>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="numero"
          label="Numéro ou nom"
          prepend-inner-icon="ri-price-tag-3-line"
          placeholder="T12"
          :rules="[required]"
          :disabled="isEdit && !canEditLayout"
          autocomplete="off"
          maxlength="50"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="capacite"
          label="Nombre de places"
          prepend-inner-icon="ri-armchair-line"
          type="number"
          inputmode="numeric"
          min="1"
          :rules="[positiveInteger]"
          :disabled="isEdit && !canEditLayout"
        />
      </VCol>
      <VCol
        cols="12"
        :sm="salle.niveaux.length > 1 ? 6 : 12"
      >
        <VCombobox
          v-model="emplacement"
          :items="locations"
          label="Zone"
          prepend-inner-icon="ri-map-pin-line"
          placeholder="Salle, terrasse, bar…"
          clearable
          :disabled="isEdit && !canEditLayout"
          maxlength="50"
          hint="Les tables d'une même zone sont regroupées sur le plan."
          persistent-hint
        />
      </VCol>
      <VCol
        v-if="salle.niveaux.length > 1"
        cols="12"
        sm="6"
      >
        <VSelect
          v-model="level"
          :items="salle.niveaux"
          item-value="id"
          item-title="nom"
          label="Niveau"
          prepend-inner-icon="ri-stack-line"
          :disabled="isEdit && !canEditLayout"
          :hint="isEdit && level !== initialLevel ? 'La table se déplace sur la première place libre du nouveau niveau.' : undefined"
          persistent-hint
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <div class="text-body-2 text-medium-emphasis mb-1">
          Forme sur le plan
        </div>
        <AppSegmented
          v-model="shape"
          :options="SHAPES"
          label="Forme de la table"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VSelect
          v-model="statut"
          :items="TABLE_STATUS_OPTIONS"
          label="Statut"
          prepend-inner-icon="ri-filter-3-line"
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
