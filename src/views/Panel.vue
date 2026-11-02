<script setup>
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { cerrarSesion, leerSesion } from '../api.js'
import { conectarTiempoReal } from '../tiempoReal.js'

// Marco del panel de RH. Abre UN canal en vivo y lo reparte a las pantallas hijas por
// provide/inject, para no abrir un socket por pestaña.

const route = useRoute()
const router = useRouter()
const alias = computed(() => route.params.alias)
const sesion = ref(leerSesion(alias.value))

const estado = ref('conectando')
const oyentes = new Set()
const recientes = reactive([])

provide('panel', {
  alias,
  sesion,
  estado,
  recientes,
  /** Una pantalla se suscribe a los eventos en vivo; devuelve la función para soltarse. */
  alEvento(fn) {
    oyentes.add(fn)
    return () => oyentes.delete(fn)
  }
})

let cerrar
onMounted(() => {
  cerrar = conectarTiempoReal(alias.value, {
    alEstado: (e) => (estado.value = e),
    alEvento: (e) => {
      if (e.tipo === 'asistencia' && (e.accion === 'entrada' || e.accion === 'salida')) {
        recientes.unshift({ ...e, id: `${e.hora}-${e.empleado_id}-${e.accion}` })
        if (recientes.length > 30) recientes.pop()
      }
      for (const fn of oyentes) fn(e)
    }
  })
})
onBeforeUnmount(() => cerrar?.())

async function salir() {
  cerrar?.()
  await cerrarSesion(alias.value)
  router.replace({ name: 'login', params: { alias: alias.value } })
}

const etiquetaEstado = computed(
  () => ({ conectado: 'En vivo', conectando: 'Conectando…', desconectado: 'Sin conexión en vivo' })[estado.value]
)
</script>

<template>
  <div class="panel">
    <header class="barra">
      <div class="marca">
        <strong>{{ sesion?.empresa?.nombre || alias }}</strong>
        <span class="vivo" :class="estado" :title="etiquetaEstado"><i></i>{{ etiquetaEstado }}</span>
      </div>
      <nav>
        <RouterLink :to="{ name: 'hoy', params: { alias } }">Hoy</RouterLink>
        <RouterLink :to="{ name: 'historial', params: { alias } }">Historial</RouterLink>
        <RouterLink :to="{ name: 'empleados', params: { alias } }">Empleados</RouterLink>
      </nav>
      <div class="usuario">
        <span class="suave">{{ sesion?.usuario?.nombre }}</span>
        <button class="boton chico" @click="salir">Salir</button>
      </div>
    </header>
    <main class="contenido"><RouterView /></main>
  </div>
</template>
