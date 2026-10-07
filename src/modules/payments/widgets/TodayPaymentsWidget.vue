<script setup lang="ts">
import PaymentSummaryCards from '../components/PaymentSummaryCards.vue'
import { rangeFor } from '../ranges'

const today = rangeFor('today')
</script>

<template>
  <section aria-label="Encaissements du jour">
    <h2 class="text-h6 mb-3">
      Encaissements du jour
    </h2>
    <PaymentSummaryCards
      :range="today"
      hint="Depuis minuit"
    />
  </section>
</template>
