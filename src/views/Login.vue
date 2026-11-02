<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { iniciarSesion } from '../api.js'

const route = useRoute()
const router = useRouter()
const alias = computed(() => route.params.alias)

const usuario = ref('')
const password = ref('')
const error = ref('')
const ocupado = ref(false)

async function entrar() {
  error.value = ''
  ocupado.value = true
  try {
    await iniciarSesion(alias.value, usuario.value.trim(), password.value)
    router.replace({ name: 'hoy', params: { alias: alias.value } })
  } catch (e) {
    error.value = e.estado === 401 ? 'Usuario o contraseña incorrectos.' : e.message
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <main class="centro">
    <section class="tarjeta">
      <div class="logo" aria-hidden="true">RH</div>
      <h1>Acceso RH</h1>
      <p class="suave">
        Empresa: <strong>{{ alias }}</strong>
      </p>
      <form @submit.prevent="entrar">
        <label class="campo">
          <span>Usuario</span>
          <input v-model="usuario" autocomplete="username" autocapitalize="none" required autofocus />
        </label>
        <label class="campo">
          <span>Contraseña</span>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="boton principal" :disabled="ocupado">{{ ocupado ? 'Entrando…' : 'Entrar' }}</button>
      </form>
      <p class="pie">
        <router-link :to="{ name: 'marcar', params: { alias } }">← Volver al marcaje</router-link>
      </p>
    </section>
  </main>
</template>
