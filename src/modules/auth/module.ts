import { defineFeature } from '@/lib/module/types'

/** Connexion, inscription, mot de passe oublié et vérification de l'e-mail. */
export default defineFeature({
  id: 'auth',
  routes: [
    {
      path: '/login',
      component: () => import('./pages/LoginPage.vue'),
      meta: { layout: 'blank', guestOnly: true, title: 'Connexion' },
    },
    {
      path: '/register',
      component: () => import('./pages/RegisterPage.vue'),
      meta: { layout: 'blank', guestOnly: true, title: 'Créer un compte' },
    },
    {
      path: '/forgot-password',
      component: () => import('./pages/ForgotPasswordPage.vue'),
      meta: { layout: 'blank', guestOnly: true, title: 'Mot de passe oublié' },
    },
    {
      // Public : le lien reçu par e-mail s'ouvre aussi dans un navigateur déjà connecté.
      path: '/reset-password',
      component: () => import('./pages/ResetPasswordPage.vue'),
      meta: { layout: 'blank', public: true, title: 'Nouveau mot de passe' },
    },
    {
      path: '/verify-email',
      component: () => import('./pages/VerifyEmailPage.vue'),
      meta: { layout: 'blank', public: true, title: 'Vérifier mon e-mail' },
    },
  ],
})
