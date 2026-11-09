<!-- Rend un texte légal balisé (gras, liens) sans v-html. -->
<script setup lang="ts">
import { computed } from 'vue'
import { parseInline } from '../content/inline'

const props = defineProps<{ text: string }>()

const segments = computed(() => parseInline(props.text))
</script>

<template>
  <template
    v-for="(segment, index) in segments"
    :key="index"
  >
    <strong v-if="segment.type === 'strong'">{{ segment.text }}</strong>
    <a
      v-else-if="segment.type === 'link' && segment.external"
      :href="segment.href"
      class="legal-link"
    >{{ segment.text }}</a>
    <RouterLink
      v-else-if="segment.type === 'link'"
      :to="segment.href"
      class="legal-link"
    >
      {{ segment.text }}
    </RouterLink>
    <template v-else>
      {{ segment.text }}
    </template>
  </template>
</template>
