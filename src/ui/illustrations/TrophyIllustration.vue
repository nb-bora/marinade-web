<!-- Trophée de la carte « Bravo » du tableau de bord. -->
<template>
  <svg
    viewBox="0 0 120 150"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    class="trophy"
  >
    <path
      d="M30 22h60v26a30 30 0 0 1-60 0V22Z"
      class="gold"
    />
    <path
      d="M30 30H16a14 14 0 0 0 14 22M90 30h14a14 14 0 0 1-14 22"
      class="handle"
    />
    <path
      d="M40 26h10v24a12 12 0 0 1-10-12V26Z"
      class="shine"
    />
    <path
      d="m60 36 4.4 9 9.9 1.4-7.2 7 1.7 9.8L60 58.6l-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4L60 36Z"
      class="star"
    />
    <rect
      x="54"
      y="78"
      width="12"
      height="22"
      class="gold-dark"
    />
    <rect
      x="36"
      y="100"
      width="48"
      height="12"
      rx="3"
      class="gold"
    />
    <rect
      x="28"
      y="112"
      width="64"
      height="20"
      rx="4"
      class="base"
    />
  </svg>
</template>

<style scoped>
.trophy { inline-size: 100%; block-size: auto; }
.gold { fill: #F5B400; }
.gold-dark { fill: #D99A00; }
.shine { fill: rgba(255, 255, 255, 0.45); }
.star { fill: #fff; }
.base { fill: rgb(var(--v-theme-primary-darken-1)); }

.handle {
  stroke: #F5B400;
  stroke-linecap: round;
  stroke-width: 6;
}
</style>
