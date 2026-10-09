<!-- Un menu ouvert, une fourchette et un couteau : l'état vide de la page des menus. -->
<template>
  <svg
    viewBox="0 0 220 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Un menu de restaurant ouvert avec une fourchette et un couteau"
    class="menus-illustration"
  >
    <ellipse
      cx="110"
      cy="146"
      rx="86"
      ry="8"
      fill="rgb(var(--v-theme-on-surface))"
      opacity="0.08"
    />
    <circle
      cx="110"
      cy="78"
      r="64"
      fill="rgb(var(--v-theme-primary))"
      opacity="0.1"
    />
    <!-- Pages -->
    <path
      d="M110 40c-14-8-36-10-54-6v82c18-4 40-2 54 6V40Z"
      fill="rgb(var(--v-theme-surface))"
      stroke="rgb(var(--v-theme-primary))"
      stroke-width="3"
      stroke-linejoin="round"
    />
    <path
      d="M110 40c14-8 36-10 54-6v82c-18-4-40-2-54 6V40Z"
      fill="rgb(var(--v-theme-surface))"
      stroke="rgb(var(--v-theme-primary))"
      stroke-width="3"
      stroke-linejoin="round"
    />
    <!-- Lignes de texte -->
    <g
      stroke="rgb(var(--v-theme-primary))"
      stroke-width="3"
      stroke-linecap="round"
      opacity="0.55"
    >
      <path d="M72 58h22M72 72h28M72 86h18" />
      <path d="M126 58h22M126 72h28M126 86h18" />
    </g>
    <circle
      cx="150"
      cy="104"
      r="3"
      fill="rgb(var(--v-theme-primary))"
    />
    <!-- Couverts -->
    <g
      stroke="rgb(var(--v-theme-primary))"
      stroke-width="4"
      stroke-linecap="round"
    >
      <path d="M32 96v34M26 96v10a6 6 0 0 0 12 0V96M32 106v24" />
      <path d="M188 96v34M188 96c8 4 10 16 4 26h-4" />
    </g>
  </svg>
</template>

<style scoped>
.menus-illustration {
  inline-size: 200px;
  max-inline-size: 70%;
}
</style>
