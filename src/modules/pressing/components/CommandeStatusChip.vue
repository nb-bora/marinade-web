<!-- Puce du statut d'une commande de pressing : libellé français, couleur et icône. -->
<script setup lang="ts">
import { STATUT_INFO } from '../commandes'
import type { CommandeStatut } from '../types'

defineProps<{ statut: CommandeStatut }>()
</script>

<template>
  <AppStatusChip
    :label="STATUT_INFO[statut].label"
    :tone="STATUT_INFO[statut].tone"
    :icon="STATUT_INFO[statut].icon"
  />
</template>
