<script setup lang="ts">
import LegalDocumentView from '../components/LegalDocumentView.vue'
import { buildPrivacy } from '../content/privacy'
import { readLegalInfo } from '../legalInfo'

const document = buildPrivacy(readLegalInfo())
</script>

<template>
  <LegalDocumentView
    :document="document"
    current="privacy"
  />
</template>
