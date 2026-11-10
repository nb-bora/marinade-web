<script setup lang="ts">
import { ordersApi } from '../api'
import { explainError } from '../labels'
import { roundMoney } from '../refunds'
import type { CommandeItem, Refund } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  commandeId: string | null

  /** Ce qu'il reste à rembourser (total, moins les remboursements approuvés et en attente). */
  remaining: number
  items: CommandeItem[]

  /** Lignes déjà remboursées : le back refuse de les rembourser une seconde fois. */
  refundedItemIds: Set<string>
  nameOf: (item: CommandeItem) => string
}>()

const emit = defineEmits<{ requested: [refund: Refund] }>()

const open = defineModel<boolean>({ required: true })

type Scope = 'total' | 'partial'

const toast = useToast()
const tenant = useTenantStore()
const scope = ref<Scope>('total')
const partialAmount = ref<number | null>(null)
const reason = ref('')
const itemIds = ref<string[]>([])
const restock = ref(false)

watch(open, isOpen => {
  if (isOpen) {
    scope.value = 'total'
    partialAmount.value = null
    reason.value = ''
    itemIds.value = []
    restock.value = false
  }
})

watch(itemIds, ids => {
  if (ids.length === 0)
    restock.value = false
})

const amount = computed(() => (scope.value === 'total' ? props.remaining : roundMoney(Number(partialAmount.value ?? 0))))

const itemOptions = computed(() => props.items
  .filter(item => !props.refundedItemIds.has(item.id))
  .map(item => ({
    value: item.id,
    title: `${item.quantite} × ${props.nameOf(item)}`,
  })))

const skippedCount = computed(() => props.items.length - itemOptions.value.length)

const { submit, pending, error } = useSubmit(async () => {
  const refund = await ordersApi.requestRefund(tenant.currentId!, props.commandeId!, {
    montant: amount.value,
    raison: reason.value.trim(),
    item_ids: itemIds.value.length ? itemIds.value : null,
    remettre_en_stock: restock.value,
  })

  toast.success('Demande de remboursement envoyée au management.')
  open.value = false
  emit('requested', refund)
})

const message = computed(() => error.value ? explainError(error.value) : '')

const amountRule = (value: number | null) => {
  const number = Number(value)

  if (!(number > 0))
    return 'Indiquez un montant supérieur à 0.'

  if (roundMoney(number) !== number)
    return 'Au plus deux décimales.'

  return number <= props.remaining ? true : `Au plus ${formatMoney(props.remaining)}.`
}

const reasonRule = (value: string) => (value.trim() ? true : 'Expliquez le motif du remboursement.')
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Demander un remboursement"
    :subtitle="`Il reste ${formatMoney(remaining)} à rembourser sur cette commande. Un manager doit valider la demande.`"
    icon="ri-refund-2-line"
    submit-label="Envoyer la demande"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <div class="mb-5">
      <AppSegmented
        v-model="scope"
        label="Étendue du remboursement"
        :options="[{ value: 'total', title: 'Tout ce qui reste' }, { value: 'partial', title: 'Montant partiel' }]"
      />
    </div>

    <div
      v-if="scope === 'total'"
      class="refund-amount mb-5"
    >
      <div class="text-body-2 text-medium-emphasis">
        Montant demandé
      </div>
      <div class="text-h5 font-weight-semibold tabular-nums">
        {{ formatMoney(remaining) }}
      </div>
    </div>
    <VTextField
      v-else
      v-model.number="partialAmount"
      label="Montant à rembourser"
      prepend-inner-icon="ri-money-dollar-circle-line"
      type="number"
      min="0"
      :max="remaining"
      suffix="FCFA"
      :rules="[amountRule]"
      class="mb-3"
    />

    <VTextarea
      v-model="reason"
      label="Motif"
      prepend-inner-icon="ri-file-text-line"
      placeholder="Plat renvoyé, erreur de commande…"
      rows="2"
      auto-grow
      maxlength="500"
      counter
      :rules="[reasonRule]"
      class="mb-3"
    />

    <VSelect
      v-if="itemOptions.length"
      v-model="itemIds"
      :items="itemOptions"
      label="Articles concernés (facultatif)"
      prepend-inner-icon="ri-list-check"
      multiple
      chips
      closable-chips
      clearable
      :hint="skippedCount > 0 ? `${skippedCount} article${skippedCount > 1 ? 's' : ''} déjà remboursé${skippedCount > 1 ? 's' : ''}, non proposé${skippedCount > 1 ? 's' : ''}.` : undefined"
      :persistent-hint="skippedCount > 0"
      class="mb-1"
    />
    <VSwitch
      v-model="restock"
      label="Remettre les ingrédients en stock"
      color="primary"
      :disabled="itemIds.length === 0"
      :hint="itemIds.length === 0 ? 'Choisissez d\'abord les articles concernés.' : 'Un plat préparé ne retourne pas en rayon : à ne cocher que si c\'est le cas.'"
      persistent-hint
    />
  </AppFormDialog>
</template>

<style scoped>
.refund-amount {
  padding: 12px 16px;
  border-radius: 14px;
  background: rgba(var(--v-theme-primary), 0.08);
}
</style>
