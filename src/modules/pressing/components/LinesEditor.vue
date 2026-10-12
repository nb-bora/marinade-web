<!--
  Liste de lignes « élément × quantité » ajoutables et supprimables (articles d'une combinaison,
  articles ou combinaisons d'une pesée). Composant générique resté dans le module : à promouvoir
  dans `src/ui` si un autre module en a besoin.
-->
<script setup lang="ts">
import type { EditableLine } from '../types'
import { newLine, toInt } from '../labels'

export interface LineItem {
  value: string
  title: string
  subtitle?: string
}

const props = withDefaults(defineProps<{
  items: LineItem[]

  /** Singulier du libellé du champ : « Article », « Combinaison ». */
  label: string
  icon: string
  addLabel: string
  emptyText: string

  /** Rend le choix d'un élément obligatoire sur chaque ligne (formulaire). */
  required?: boolean
  idPrefix?: string
}>(), { required: false, idPrefix: 'line' })

const lines = defineModel<EditableLine[]>({ required: true })

const lowerLabel = computed(() => props.label.toLowerCase())

const quantityRules = [
  (value: string) => (toInt(value) !== null && Number(value) >= 1) || 'Indiquez une quantité entière, au moins 1.',
]

function chooseRules(line: EditableLine) {
  const rules: Array<(value: string | null) => true | string> = []

  if (props.required)
    rules.push(value => !!value || `Choisissez un ${lowerLabel.value}.`)

  rules.push(value => !value || lines.value.every(other => other.uid === line.uid || other.id !== value)
    || `Cet ${lowerLabel.value} figure déjà dans la liste : augmentez plutôt sa quantité.`)

  return rules
}

function add() {
  lines.value = [...lines.value, newLine()]
}

function remove(uid: number) {
  lines.value = lines.value.filter(line => line.uid !== uid)
}
</script>

<template>
  <div class="lines-editor">
    <p
      v-if="lines.length === 0"
      class="text-body-2 text-medium-emphasis mb-3"
    >
      {{ emptyText }}
    </p>

    <div
      v-for="(line, index) in lines"
      :key="line.uid"
      class="lines-editor__row d-flex align-start gap-3 mb-3"
    >
      <VAutocomplete
        v-model="line.id"
        :items="items"
        item-title="title"
        item-value="value"
        :label="label"
        :prepend-inner-icon="icon"
        :placeholder="`Choisir un ${lowerLabel}`"
        :rules="chooseRules(line)"
        :data-testid="`${idPrefix}-item-${index}`"
        no-data-text="Aucun résultat."
        class="lines-editor__item"
        clearable
      >
        <template #item="{ props: itemProps, item }">
          <VListItem
            v-bind="itemProps"
            :subtitle="item.raw.subtitle"
          />
        </template>
      </VAutocomplete>
      <VTextField
        v-model="line.quantite"
        label="Quantité"
        prepend-inner-icon="ri-hashtag"
        inputmode="numeric"
        :rules="quantityRules"
        :data-testid="`${idPrefix}-qty-${index}`"
        class="lines-editor__qty"
      />
      <IconBtn
        :aria-label="`Retirer cette ligne (${label} ${index + 1})`"
        class="mt-1"
        @click="remove(line.uid)"
      >
        <VIcon icon="ri-delete-bin-line" />
      </IconBtn>
    </div>

    <VBtn
      variant="tonal"
      prepend-icon="ri-add-line"
      :data-testid="`${idPrefix}-add`"
      @click="add"
    >
      {{ addLabel }}
    </VBtn>
  </div>
</template>

<style scoped>
.lines-editor__item {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.lines-editor__qty {
  flex: 0 0 8.5rem;
}

@media (width <= 600px) {
  .lines-editor__row {
    flex-wrap: wrap;
  }

  .lines-editor__item {
    flex-basis: 100%;
  }

  .lines-editor__qty {
    flex: 1 1 0;
  }
}
</style>
