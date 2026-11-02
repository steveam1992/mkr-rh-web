<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const alias = ref('')

function ir() {
  const a = alias.value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (a) router.push({ name: 'marcar', params: { alias: a } })
}
</script>

<template>
  <main class="centro">
    <section class="tarjeta">
      <div class="logo" aria-hidden="true">✓</div>
      <h1>MKR RH</h1>
      <p class="suave">Escribe el identificador de tu empresa para marcar tu entrada y salida.</p>
      <form @submit.prevent="ir">
        <label class="campo">
          <span>Identificador de la empresa</span>
          <input v-model="alias" placeholder="empresa-pescadera" autocapitalize="none" autocomplete="off" autofocus />
        </label>
        <button class="boton principal" :disabled="!alias.trim()">Continuar</button>
      </form>
      <p class="pie">También puedes entrar directo con el enlace que te dio RH: <code>/tu-empresa</code></p>
    </section>
  </main>
</template>
