import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { loadEnv } from 'vite'
import vuetify from 'vite-plugin-vuetify'
import svgLoader from 'vite-svg-loader'
import { defineConfig } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // En développement, l'API est atteinte via `/api` : le navigateur ne voit qu'une origine,
  // donc ni CORS ni cookies tiers à configurer. `/api/v1/x` devient `http://localhost:8000/v1/x`.
  const apiTarget = env.MARINADE_API_URL || 'http://localhost:8000'

  return {
    plugins: [
      vue(),
      vueJsx(),

      // Docs: https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin
      vuetify({
        styles: {
          configFile: 'src/assets/styles/variables/_vuetify.scss',
        },
      }),
      Components({
        dirs: ['src/@core/components', 'src/ui'],
        dts: true,
        resolvers: [
          componentName => {
            // Auto import `VueApexCharts`
            if (componentName === 'VueApexCharts')
              return { name: 'default', from: 'vue3-apexcharts', as: 'VueApexCharts' }
          },
        ],
      }),

      // Docs: https://github.com/antfu/unplugin-auto-import#unplugin-auto-import
      AutoImport({
        imports: ['vue', 'vue-router', '@vueuse/core', '@vueuse/math', 'pinia'],
        vueTemplate: true,

        // ℹ️ Disabled to avoid confusion & accidental usage
        ignore: ['useCookies', 'useStorage'],
      }),
      svgLoader(),
    ],
    define: { 'process.env': {} },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@core': fileURLToPath(new URL('./src/@core', import.meta.url)),
        '@layouts': fileURLToPath(new URL('./src/@layouts', import.meta.url)),
        '@images': fileURLToPath(new URL('./src/assets/images/', import.meta.url)),
        '@styles': fileURLToPath(new URL('./src/assets/styles/', import.meta.url)),
        '@configured-variables': fileURLToPath(new URL('./src/assets/styles/variables/_template.scss', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
          rewrite: path => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            vuetify: ['vuetify'],
            charts: ['apexcharts', 'vue3-apexcharts'],
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['vuetify'],
      entries: [
        './src/**/*.vue',
      ],
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.ts'],
      globals: false,
    },
  }
})
