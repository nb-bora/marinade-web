<!-- Cloche de service et téléphone « paiement reçu » : l'univers de Marinade en une image. -->
<template>
  <svg
    viewBox="0 0 440 400"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Un plat servi sous cloche et un paiement Mobile Money confirmé"
    class="service-illustration"
  >
    <!-- Ombre au sol -->
    <ellipse
      cx="210"
      cy="352"
      rx="170"
      ry="16"
      class="tone-shadow"
    />

    <!-- Feuillage décoratif -->
    <path
      d="M58 350c-6-40 6-86 30-112 4 34-4 78-30 112Z"
      class="tone-leaf"
    />
    <path
      d="M58 350c2-30 22-62 50-74-6 30-24 58-50 74Z"
      class="tone-leaf-soft"
    />
    <path
      d="M58 350c-10-24-34-44-56-48 8 22 30 42 56 48Z"
      class="tone-leaf-soft"
    />

    <!-- Vapeur -->
    <path
      d="M168 96c-12-14 12-22 0-38"
      class="steam"
    />
    <path
      d="M204 84c-12-16 12-24 0-42"
      class="steam steam--late"
    />
    <path
      d="M240 96c-12-14 12-22 0-38"
      class="steam steam--later"
    />

    <!-- Assiette -->
    <ellipse
      cx="204"
      cy="318"
      rx="150"
      ry="20"
      class="tone-plate"
    />
    <ellipse
      cx="204"
      cy="312"
      rx="132"
      ry="12"
      class="tone-plate-inner"
    />

    <!-- Cloche -->
    <path
      d="M84 304c0-80 54-150 120-150s120 70 120 150Z"
      class="tone-primary"
    />
    <path
      d="M118 286c4-58 38-104 84-114-30 22-50 66-52 114Z"
      class="tone-highlight"
    />
    <rect
      x="70"
      y="298"
      width="268"
      height="14"
      rx="7"
      class="tone-primary-dark"
    />
    <circle
      cx="204"
      cy="144"
      r="14"
      class="tone-primary-dark"
    />

    <!-- Téléphone -->
    <g transform="rotate(8 360 220)">
      <rect
        x="300"
        y="118"
        width="112"
        height="206"
        rx="18"
        class="tone-device"
      />
      <rect
        x="308"
        y="132"
        width="96"
        height="178"
        rx="10"
        class="tone-screen"
      />
      <circle
        cx="356"
        cy="190"
        r="22"
        class="tone-success-soft"
      />
      <path
        d="m345 190 8 8 15-16"
        class="check"
      />
      <rect
        x="326"
        y="228"
        width="60"
        height="8"
        rx="4"
        class="tone-line-strong"
      />
      <rect
        x="334"
        y="244"
        width="44"
        height="6"
        rx="3"
        class="tone-line"
      />
      <rect
        x="320"
        y="270"
        width="72"
        height="22"
        rx="8"
        class="tone-primary"
      />
    </g>
  </svg>
</template>

<style scoped>
.service-illustration {
  inline-size: 100%;
  block-size: auto;
}

.tone-shadow { fill: rgba(var(--v-theme-on-surface), 0.06); }
.tone-leaf { fill: rgba(var(--v-theme-primary), 0.55); }
.tone-leaf-soft { fill: rgba(var(--v-theme-primary), 0.3); }
.tone-plate { fill: rgba(var(--v-theme-on-surface), 0.1); }
.tone-plate-inner { fill: rgb(var(--v-theme-surface)); }
.tone-primary { fill: rgb(var(--v-theme-primary)); }
.tone-primary-dark { fill: rgb(var(--v-theme-primary-darken-1)); }
.tone-highlight { fill: rgba(255, 255, 255, 0.22); }
.tone-device { fill: rgb(var(--v-theme-grey-900)); }
.tone-screen { fill: rgb(var(--v-theme-surface)); }
.tone-success-soft { fill: rgba(var(--v-theme-success), 0.16); }
.tone-line-strong { fill: rgba(var(--v-theme-on-surface), 0.7); }
.tone-line { fill: rgba(var(--v-theme-on-surface), 0.2); }

.check {
  stroke: rgb(var(--v-theme-success));
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 5;
}

.steam {
  animation: rise 3.2s ease-in-out infinite;
  stroke: rgba(var(--v-theme-primary), 0.45);
  stroke-linecap: round;
  stroke-width: 6;
}

.steam--late { animation-delay: 0.6s; }
.steam--later { animation-delay: 1.2s; }

@keyframes rise {
  0%, 100% { opacity: 0.35; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-6px); }
}

@media (prefers-reduced-motion: reduce) {
  .steam { animation: none; }
}
</style>
