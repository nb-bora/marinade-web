<!-- Réécrit toute la fiche technique d'un plat en une seule fois. -->
<script setup lang="ts">
import { stockApi } from '../api'
import { UNITS, parseQty, positiveQty, required } from '../labels'
import type { Composant, Plat, PlatComposant } from '../types'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

interface Draft {
  key: number
  composantId: string | null
  quantity: string
  unit: string | null
}

const props = defineProps<{
  plat: Plat | null
  lines: PlatComposant[]
  composants: Composant[]
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()
const confirm = useConfirm()
const drafts = ref<Draft[]>([])
let counter = 0

const options = computed(() => props.composants
  .map(item => ({ value: item.id, title: item.nom }))
  .sort((a, b) => a.title.localeCompare(b.title, 'fr')))

function blank(): Draft {
  return { key: counter++, composantId: null, quantity: '1', unit: 'portion' }
}

function pick(draft: Draft, id: string | null) {
  draft.composantId = id

  const composant = props.composants.find(item => item.id === id)

  if (composant)
    draft.unit = composant.stock_unite
}

const duplicate = (draft: Draft) =>
  !draft.composantId || drafts.value.filter(other => other.composantId === draft.composantId).length === 1
  || 'Ce composant figure déjà dans la fiche.'

const save = useSubmit(async () => {
  if (!props.plat)
    return

  if (drafts.value.length === 0 && !await confirm({
    title: 'Vider la fiche technique ?',
    text: 'Le plat ne consommera plus aucun composant du stock.',
    confirmLabel: 'Supprimer',
    danger: true,
  }))
    return

  await stockApi.replaceRecipe(props.plat.id, drafts.value.map(draft => ({
    composant_id: draft.composantId as string,
    quantite: parseQty(draft.quantity),
    unite: (draft.unit ?? '').trim(),
  })))
  toast.success('Fiche technique remplacée.')
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  drafts.value = props.lines.map(line => ({
    key: counter++,
    composantId: line.composant_id,
    quantity: String(Number(line.quantite)).replace('.', ','),
    unit: line.unite,
  }))
  save.reset()
})
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Remplacer toute la fiche"
    :subtitle="plat ? `Nouvelle liste de composants pour « ${plat.nom} »` : undefined"
    icon="ri-file-edit-line"
    submit-label="Remplacer la fiche"
    :loading="save.pending.value"
    :error="save.message.value"
    @submit="save.submit()"
  >
    <p class="text-body-2 text-medium-emphasis mb-4">
      La liste ci-dessous remplace entièrement l'actuelle : les lignes retirées sont supprimées.
    </p>

    <div
      v-for="draft in drafts"
      :key="draft.key"
      class="draft-row"
    >
      <VAutocomplete
        :model-value="draft.composantId"
        :items="options"
        label="Composant"
        prepend-inner-icon="ri-flask-line"
        :rules="[required('Choisissez un composant.'), () => duplicate(draft)]"
        @update:model-value="pick(draft, $event)"
      />
      <VTextField
        v-model="draft.quantity"
        label="Quantité"
        prepend-inner-icon="ri-hashtag"
        inputmode="decimal"
        autocomplete="off"
        :rules="[positiveQty]"
      />
      <VCombobox
        v-model="draft.unit"
        :items="UNITS"
        label="Unité"
        prepend-inner-icon="ri-scales-line"
        :rules="[required('Unité ?')]"
      />
      <IconBtn
        aria-label="Retirer cette ligne"
        class="draft-row__remove"
        @click="drafts = drafts.filter(other => other.key !== draft.key)"
      >
        <VIcon icon="ri-delete-bin-line" />
      </IconBtn>
    </div>

    <VBtn
      variant="outlined"
      prepend-icon="ri-add-line"
      @click="drafts.push(blank())"
    >
      Ajouter une ligne
    </VBtn>
  </AppFormDialog>
</template>

<style scoped>
.draft-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 6.5rem 8rem auto;
  gap: 0.75rem;
  align-items: start;
  margin-block-end: 0.25rem;
}

@media (max-width: 600px) {
  .draft-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    padding-block-end: 0.5rem;
    border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    margin-block-end: 0.75rem;
  }

  .draft-row > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
