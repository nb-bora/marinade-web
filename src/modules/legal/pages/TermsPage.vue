<script setup lang="ts">
import LegalDocumentView from '../components/LegalDocumentView.vue'
import { buildTerms } from '../content/terms'
import { readLegalInfo } from '../legalInfo'

const document = buildTerms(readLegalInfo())
</script>

<template>
  <LegalDocumentView
    :document="document"
    current="terms"
  />
</template>
