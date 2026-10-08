<!-- La commande en cours de saisie : quantités, notes, poste de préparation, envoi. -->
<script setup lang="ts">
import { STATION_LABEL, STATION_OPTIONS, plural } from '../labels'
import type { CartLine } from '../types'
import { formatMoney } from '@/lib/format'

defineProps<{
  submitting: boolean
  error: string
}>()

const emit = defineEmits<{ submit: [] }>()

const lines = defineModel<CartLine[]>({ required: true })

const editing = ref<string | null>(null)

const count = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0))
const subtotal = computed(() => lines.value.reduce((sum, line) => sum + line.quantity * line.item.price, 0))

function change(line: CartLine, delta: number) {
  line.quantity = Math.min(99, line.quantity + delta)

  if (line.quantity <= 0)
    lines.value = lines.value.filter(other => other !== line)
}

const toggle = (line: CartLine) => {
  editing.value = editing.value === line.item.id ? null : line.item.id
}
</script>

<template>
  <VCard>
    <VCardItem class="pb-2">
      <VCardTitle>Nouvelle commande</VCardTitle>
      <VCardSubtitle>{{ count ? plural(count, 'article') : 'Aucun article choisi' }}</VCardSubtitle>
      <template
        v-if="lines.length"
        #append
      >
        <VBtn
          variant="text"
          size="small"
          color="secondary"
          :disabled="submitting"
          @click="lines = []"
        >
          Vider
        </VBtn>
      </template>
    </VCardItem>

    <AppEmptyState
      v-if="!lines.length"
      icon="ri-shopping-basket-2-line"
      title="Commande vide"
      text="Choisissez des articles dans la carte : ils apparaissent ici avant l'envoi en cuisine."
    />

    <template v-else>
      <VDivider />
      <ul class="lines">
        <li
          v-for="line in lines"
          :key="line.item.id"
          class="line"
        >
          <div class="d-flex align-center gap-3">
            <div class="min-w-0 flex-grow-1">
              <div class="font-weight-medium text-wrap line__name">
                {{ line.item.name }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ formatMoney(line.item.price, line.item.currency) }} · {{ STATION_LABEL[line.station] }}
              </div>
            </div>
            <div class="stepper">
              <VBtn
                icon="ri-subtract-line"
                size="small"
                variant="tonal"
                :aria-label="line.quantity === 1 ? `Retirer ${line.item.name}` : `Un ${line.item.name} de moins`"
                @click="change(line, -1)"
              />
              <span
                class="stepper__value tabular-nums"
                aria-live="polite"
              >{{ line.quantity }}</span>
              <VBtn
                icon="ri-add-line"
                size="small"
                variant="tonal"
                color="primary"
                :aria-label="`Un ${line.item.name} de plus`"
                @click="change(line, 1)"
              />
            </div>
          </div>

          <div class="d-flex align-center justify-space-between mt-1">
            <VBtn
              variant="text"
              size="small"
              :prepend-icon="editing === line.item.id ? 'ri-arrow-up-s-line' : 'ri-edit-line'"
              @click="toggle(line)"
            >
              {{ line.notes ? `Note : ${line.notes}` : 'Note et poste' }}
            </VBtn>
            <span class="font-weight-semibold tabular-nums text-no-wrap">{{ formatMoney(line.quantity * line.item.price, line.item.currency) }}</span>
          </div>

          <div
            v-if="editing === line.item.id"
            class="mt-2"
          >
            <VTextField
              v-model="line.notes"
              label="Note pour la cuisine"
              placeholder="Sans piment, bien cuit…"
              density="compact"
              maxlength="200"
              clearable
              hide-details
              class="mb-3"
            />
            <VSelect
              v-model="line.station"
              :items="STATION_OPTIONS"
              label="À préparer à"
              density="compact"
              hide-details
            />
          </div>
        </li>
      </ul>

      <VDivider />

      <VCardText>
        <div class="d-flex align-center justify-space-between mb-1">
          <span class="text-body-1 text-medium-emphasis">Sous-total (hors taxes)</span>
          <span class="text-h6 tabular-nums">{{ formatMoney(subtotal, lines[0]?.item.currency) }}</span>
        </div>
        <p class="text-caption text-medium-emphasis mb-4">
          Les taxes sont ajoutées par le serveur : le montant exact figure sur l'addition.
        </p>

        <VAlert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ error }}
        </VAlert>

        <VBtn
          block
          size="large"
          color="primary"
          prepend-icon="ri-send-plane-2-line"
          :loading="submitting"
          @click="emit('submit')"
        >
          Envoyer la commande
        </VBtn>
      </VCardText>
    </template>
  </VCard>
</template>

<style scoped>
.lines {
  margin: 0;
  padding: 0;
  list-style: none;
}

.line {
  padding: 12px 16px;
}

.line + .line {
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.line__name {
  overflow-wrap: anywhere;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stepper__value {
  min-inline-size: 1.75rem;
  font-size: 1.125rem;
  font-weight: 700;
  text-align: center;
}
</style>
