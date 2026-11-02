import { createRouter, createWebHistory } from 'vue-router'
import { leerSesion } from './api.js'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'inicio', component: () => import('./views/Inicio.vue') },
    // La empresa viaja en la URL: /empresa-pescadera marca; /empresa-pescadera/admin es el panel de RH.
    { path: '/:alias([a-z0-9][a-z0-9-]*)', name: 'marcar', component: () => import('./views/Marcar.vue') },
    { path: '/:alias([a-z0-9][a-z0-9-]*)/admin/login', name: 'login', component: () => import('./views/Login.vue') },
    {
      path: '/:alias([a-z0-9][a-z0-9-]*)/admin',
      component: () => import('./views/Panel.vue'),
      meta: { requiereSesion: true },
      children: [
        { path: '', redirect: (to) => ({ name: 'hoy', params: to.params }) },
        { path: 'hoy', name: 'hoy', component: () => import('./views/Hoy.vue') },
        { path: 'historial', name: 'historial', component: () => import('./views/Historial.vue') },
        { path: 'empleados', name: 'empleados', component: () => import('./views/Empleados.vue') }
      ]
    },
    { path: '/:resto(.*)*', redirect: '/' }
  ]
})

router.beforeEach((to) => {
  if (to.meta.requiereSesion && !leerSesion(to.params.alias)) {
    return { name: 'login', params: { alias: to.params.alias } }
  }
})
