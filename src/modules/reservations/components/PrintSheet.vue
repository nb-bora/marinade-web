<!--
  Feuille du jour pour l'impression : les réservations du jour, par heure, avec une case à cocher à
  l'arrivée. Invisible à l'écran ; à l'impression, seule cette feuille reste visible.
-->
<script setup lang="ts">
import type { Booking } from '../composables/useReservationRange'
import { formatClock, formatFullDate } from '../calendar'
import { coversLabel, isDead, presentStatus, sourceLabel } from '../labels'

const props = defineProps<{
  day: Date
  bookings: Booking[]
  zone: string
  restaurantName: string
  waitingCount: number
  tableLabelOf: (id: string | null | undefined) => string
}>()

const rows = computed(() => props.bookings
  .filter(({ reservation }) => !isDead(reservation.status))
  .sort((a, b) => a.start.getTime() - b.start.getTime()))

const totalCovers = computed(() => rows.value.reduce((sum, { reservation }) => sum + reservation.party_size, 0))
</script>

<template>
  <section
    class="print-sheet"
    aria-label="Feuille du jour à imprimer"
  >
    <header class="print-sheet__head">
      <div>
        <h1>{{ restaurantName }}</h1>
        <p class="print-sheet__date">
          Réservations · {{ formatFullDate(day, zone) }}
        </p>
      </div>
      <p class="print-sheet__totals">
        {{ rows.length }} réservation{{ rows.length > 1 ? 's' : '' }} · {{ coversLabel(totalCovers) }}
        <template v-if="waitingCount">
          · {{ waitingCount }} en attente
        </template>
      </p>
    </header>

    <table class="print-sheet__table">
      <thead>
        <tr>
          <th scope="col">
            Arrivée
          </th>
          <th scope="col">
            Nom
          </th>
          <th scope="col">
            Couverts
          </th>
          <th scope="col">
            Table
          </th>
          <th scope="col">
            Téléphone
          </th>
          <th scope="col">
            État
          </th>
          <th scope="col">
            Notes
          </th>
          <th
            scope="col"
            class="print-sheet__check"
          >
            Arrivé
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="{ reservation, start } in rows"
          :key="reservation.id"
        >
          <td>{{ formatClock(start, zone) }}</td>
          <td><strong>{{ reservation.customer_name }}</strong></td>
          <td>{{ reservation.party_size }}</td>
          <td>{{ reservation.table_id ? tableLabelOf(reservation.table_id) : '—' }}</td>
          <td>{{ reservation.customer_phone ?? '—' }}</td>
          <td>
            {{ presentStatus(reservation.status).label }}<template v-if="reservation.source !== 'POS'">
              · {{ sourceLabel(reservation.source) }}
            </template>
          </td>
          <td>{{ reservation.notes ?? '' }}</td>
          <td class="print-sheet__check">
            ☐
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td
            colspan="8"
            class="print-sheet__empty"
          >
            Aucune réservation ce jour-là.
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style>
.print-sheet {
  display: none;
}

@media print {
  body * {
    visibility: hidden;
  }

  .print-sheet,
  .print-sheet * {
    visibility: visible;
  }

  .print-sheet {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    display: block;
    padding: 12mm;
    background: #fff;
    color: #000;
    font-size: 11pt;
  }

  .print-sheet h1 {
    font-size: 16pt;
    margin: 0;
  }

  @page {
    size: A4 landscape;
    margin: 10mm;
  }
}

.print-sheet__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  border-bottom: 2px solid #000;
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.print-sheet__date,
.print-sheet__totals {
  margin: 2px 0 0;
}

.print-sheet__table {
  width: 100%;
  border-collapse: collapse;
}

.print-sheet__table th,
.print-sheet__table td {
  border-bottom: 1px solid #999;
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}

.print-sheet__table th {
  border-bottom-color: #000;
  font-size: 10pt;
}

.print-sheet__check {
  text-align: center;
  width: 60px;
}

.print-sheet__empty {
  text-align: center;
  padding: 20px;
}
</style>
