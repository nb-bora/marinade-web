<!--
  Reçu à l'écran, imprimable : un ticket étroit (80 mm), noir sur blanc dans les deux thèmes.
  À l'impression, seule cette fenêtre sort (voir la feuille de style non scopée plus bas).
-->
<script setup lang="ts">
import { methodLabel } from '../labels'
import type { Invoice, OrderedLine, ReceiptPayment } from '../types'
import { formatDateTime, formatMoney } from '@/lib/format'

const props = withDefaults(defineProps<{
  invoice: Invoice

  /** Règlements de cet encaissement (vide pour une simple facture). */
  payments?: ReceiptPayment[]
  lines?: OrderedLine[]
  restaurantName: string
  city?: string | null
  tableLabel?: string | null
  currency?: string

  /** Espèces : montant remis et monnaie rendue. */
  tendered?: number | null
  change?: number
  paidAt?: Date
  title?: string
}>(), {
  payments: () => [],
  lines: () => [],
  city: null,
  tableLabel: null,
  currency: 'XAF',
  tendered: null,
  change: 0,
  paidAt: undefined,
  title: 'Reçu',
})

const open = defineModel<boolean>({ required: true })

const money = (value: number | string) => formatMoney(value, props.currency)
const paidNow = computed(() => props.payments.reduce((sum, payment) => sum + payment.amount, 0))
const settled = computed(() => Number(props.invoice.amount_due) <= 0)

/** `window.print` n'imprime que ce qui est visible : une classe sur le body masque tout le reste. */
function print() {
  const clear = () => {
    document.body.classList.remove('cashdesk-printing')
    window.removeEventListener('afterprint', clear)
  }

  document.body.classList.add('cashdesk-printing')
  window.addEventListener('afterprint', clear)
  window.print()
}
</script>

<template>
  <VDialog
    v-model="open"
    max-width="440"
    scrollable
    class="cashdesk-print-overlay"
  >
    <VCard class="receipt-card">
      <VCardItem class="cashdesk-no-print pt-5 px-6">
        <VCardTitle class="text-h5">
          {{ title }}
        </VCardTitle>
        <template #append>
          <IconBtn
            aria-label="Fermer"
            @click="open = false"
          >
            <VIcon icon="ri-close-line" />
          </IconBtn>
        </template>
      </VCardItem>

      <VCardText class="px-6 pt-2">
        <article
          class="receipt"
          aria-label="Reçu"
        >
          <header class="receipt__head">
            <strong class="receipt__name">{{ restaurantName }}</strong>
            <span v-if="city">{{ city }}</span>
            <span>{{ formatDateTime(paidAt ?? invoice.created_at) }}</span>
          </header>

          <hr>

          <dl class="receipt__meta">
            <div>
              <dt>Facture</dt>
              <dd>{{ invoice.invoice_number }}</dd>
            </div>
            <div v-if="tableLabel">
              <dt>Table</dt>
              <dd>{{ tableLabel }}</dd>
            </div>
          </dl>

          <template v-if="lines.length">
            <hr>
            <ul class="receipt__lines">
              <li
                v-for="line in lines"
                :key="line.name"
              >
                <span>{{ line.quantity }} ×</span>
                <span>{{ line.name }}</span>
              </li>
            </ul>
          </template>

          <hr>

          <dl class="receipt__rows">
            <div>
              <dt>Sous-total</dt>
              <dd>{{ money(invoice.subtotal) }}</dd>
            </div>
            <div>
              <dt>Taxes</dt>
              <dd>{{ money(invoice.tax_amount) }}</dd>
            </div>
            <div v-if="Number(invoice.service_charge) !== 0">
              <dt>Service</dt>
              <dd>{{ money(invoice.service_charge) }}</dd>
            </div>
            <div v-if="Number(invoice.discount_amount) !== 0">
              <dt>Remise</dt>
              <dd>− {{ money(invoice.discount_amount) }}</dd>
            </div>
            <div class="receipt__total">
              <dt>Total</dt>
              <dd>{{ money(invoice.total_amount) }}</dd>
            </div>
          </dl>

          <template v-if="payments.length">
            <hr>
            <dl class="receipt__rows">
              <div
                v-for="(payment, index) in payments"
                :key="index"
              >
                <dt>
                  {{ methodLabel(payment.method) }}
                  <small v-if="payment.reference">{{ payment.reference }}</small>
                </dt>
                <dd>{{ money(payment.amount) }}</dd>
              </div>
              <div
                v-if="tendered !== null && tendered > 0"
                class="receipt__soft"
              >
                <dt>Remis</dt>
                <dd>{{ money(tendered) }}</dd>
              </div>
              <div
                v-if="change > 0"
                class="receipt__soft"
              >
                <dt>Monnaie rendue</dt>
                <dd>{{ money(change) }}</dd>
              </div>
              <div class="receipt__total">
                <dt>Payé aujourd'hui</dt>
                <dd>{{ money(paidNow) }}</dd>
              </div>
            </dl>
          </template>

          <hr>

          <dl class="receipt__rows">
            <div>
              <dt>Déjà payé au total</dt>
              <dd>{{ money(invoice.amount_paid) }}</dd>
            </div>
            <div class="receipt__total">
              <dt>{{ settled ? 'Addition soldée' : 'Reste dû' }}</dt>
              <dd>{{ money(invoice.amount_due) }}</dd>
            </div>
          </dl>

          <p class="receipt__thanks">
            Merci de votre visite !
          </p>
        </article>
      </VCardText>

      <VCardActions class="cashdesk-no-print px-6 pb-5">
        <VSpacer />
        <VBtn
          variant="outlined"
          color="secondary"
          @click="open = false"
        >
          Fermer
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="ri-printer-line"
          @click="print"
        >
          Imprimer
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.receipt {
  margin-inline: auto;
  padding: 20px 18px;
  max-inline-size: 340px;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.18);
  color: #111;
  font-family: 'Courier New', ui-monospace, monospace;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.receipt hr {
  margin-block: 10px;
  border: none;
  border-block-start: 1px dashed #777;
}

.receipt__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.receipt__name {
  font-size: 1.125rem;
}

.receipt dl,
.receipt ul {
  margin: 0;
  padding: 0;
}

.receipt dl > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.receipt dd {
  margin: 0;
  text-align: end;
  white-space: nowrap;
}

.receipt dt small {
  display: block;
  color: #555;
  overflow-wrap: anywhere;
}

.receipt__lines {
  list-style: none;
}

.receipt__lines li {
  display: flex;
  gap: 8px;
}

.receipt__soft {
  color: #555;
}

.receipt__total {
  font-size: 1rem;
  font-weight: 700;
}

.receipt__thanks {
  margin: 14px 0 0;
  text-align: center;
}
</style>

<style>
/* Impression : seul le ticket sort, sur une bande de 80 mm. Ces règles ne s'appliquent
   que pendant `window.print()` (classe posée par le bouton Imprimer). */
@media print {
  @page {
    margin: 4mm;
    size: 80mm auto;
  }

  body.cashdesk-printing #app,
  body.cashdesk-printing .v-overlay__scrim,
  body.cashdesk-printing .cashdesk-no-print,
  body.cashdesk-printing .v-overlay-container > .v-overlay:not(.cashdesk-print-overlay) {
    display: none !important;
  }

  body.cashdesk-printing,
  body.cashdesk-printing .v-overlay-container,
  body.cashdesk-printing .cashdesk-print-overlay {
    position: static !important;
    overflow: visible !important;
    background: #fff !important;
  }

  body.cashdesk-printing .cashdesk-print-overlay .v-overlay__content {
    position: static !important;
    margin: 0 !important;
    max-inline-size: none !important;
    inline-size: 72mm !important;
    transform: none !important;
  }

  body.cashdesk-printing .cashdesk-print-overlay .v-card,
  body.cashdesk-printing .cashdesk-print-overlay .v-card-text {
    padding: 0 !important;
    box-shadow: none !important;
    background: #fff !important;
    overflow: visible !important;
  }

  body.cashdesk-printing .receipt {
    box-shadow: none !important;
    padding: 0 !important;
    max-inline-size: none !important;
  }
}
</style>
