<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { panel as api, puedeEscribir } from '../api.js'

const panel = inject('panel')
const alias = panel.alias

const datos = ref(null)
const cargando = ref(true)
const error = ref('')
const fecha = ref('')
const filtro = ref('todos')
const q = ref('')
const edicion = ref(null)
const guardando = ref(false)
const errorEdicion = ref('')

const puedeCorregir = computed(() => puedeEscribir(panel.sesion.value, 'asistencia'))

async function cargar({ silencioso = false } = {}) {
  if (!silencioso) cargando.value = true
  error.value = ''
  try {
    const d = await api.hoy(alias.value, fecha.value || undefined)
    datos.value = d
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const visibles = computed(() => {
  const texto = q.value.trim().toLowerCase()
  return (datos.value?.empleados || []).filter((e) => {
    if (filtro.value === 'retardo' ? !(e.minutos_retardo > 0) : filtro.value !== 'todos' && e.estado !== filtro.value) {
      return false
    }
    if (!texto) return true
    return `${e.numero_empleado} ${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`
      .toLowerCase()
      .includes(texto)
  })
})

const nombre = (e) => [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ')

const ETIQUETA = { dentro: 'Dentro', completo: 'Completo', sin_marcar: 'Sin marcar' }

function abrirEdicion(e) {
  if (!puedeCorregir.value) return
  errorEdicion.value = ''
  edicion.value = {
    empleado: e,
    hora_entrada: e.marca_entrada || '',
    hora_salida: e.marca_salida || '',
    estatus: e.estatus_dia || 'auto',
    nota: e.nota || ''
  }
}

async function guardar() {
  const ed = edicion.value
  guardando.value = true
  errorEdicion.value = ''
  try {
    await api.corregir(alias.value, ed.empleado.id, datos.value.fecha, {
      hora_entrada: ed.hora_entrada || null,
      hora_salida: ed.hora_salida || null,
      estatus: ed.estatus,
      nota: ed.nota || null
    })
    edicion.value = null
    await cargar({ silencioso: true })
  } catch (e) {
    errorEdicion.value = e.message
  } finally {
    guardando.value = false
  }
}

async function quitar() {
  const ed = edicion.value
  if (!confirm(`¿Quitar el registro de ${nombre(ed.empleado)} del ${datos.value.fecha}?`)) return
  guardando.value = true
  try {
    await api.quitar(alias.value, ed.empleado.id, datos.value.fecha)
    edicion.value = null
    await cargar({ silencioso: true })
  } catch (e) {
    errorEdicion.value = e.message
  } finally {
    guardando.value = false
  }
}

// En vivo: cada marca (desde la web o la computadora de RH) refresca el tablero.
let soltar
let rebote
onMounted(() => {
  cargar()
  soltar = panel.alEvento((e) => {
    if (e.tipo !== 'asistencia' && e.tipo !== 'sync') return
    clearTimeout(rebote)
    rebote = setTimeout(() => cargar({ silencioso: true }), 300)
  })
})
onBeforeUnmount(() => {
  soltar?.()
  clearTimeout(rebote)
})
</script>

<template>
  <section>
    <div class="encabezado">
      <h1>
        Asistencia
        <small v-if="datos">{{ datos.fecha }}<template v-if="datos.festivo"> · 🎉 {{ datos.festivo }}</template></small>
      </h1>
      <label class="campo en-linea">
        <span class="sr">Fecha</span>
        <input v-model="fecha" type="date" @change="cargar()" />
      </label>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="cargando && !datos" class="suave">Cargando…</p>

    <template v-if="datos">
      <div class="resumen">
        <button :class="{ activo: filtro === 'todos' }" @click="filtro = 'todos'">
          <b>{{ datos.resumen.total }}</b> Plantilla
        </button>
        <button class="verde" :class="{ activo: filtro === 'dentro' }" @click="filtro = 'dentro'">
          <b>{{ datos.resumen.dentro }}</b> Dentro
        </button>
        <button :class="{ activo: filtro === 'completo' }" @click="filtro = 'completo'">
          <b>{{ datos.resumen.completos }}</b> Completos
        </button>
        <button class="gris" :class="{ activo: filtro === 'sin_marcar' }" @click="filtro = 'sin_marcar'">
          <b>{{ datos.resumen.sin_marcar }}</b> Sin marcar
        </button>
        <button class="ambar" :class="{ activo: filtro === 'retardo' }" @click="filtro = 'retardo'">
          <b>{{ datos.resumen.retardos }}</b> Retardos
        </button>
      </div>

      <div class="cols">
        <div class="principal">
          <input v-model="q" class="buscar" type="search" placeholder="Buscar por nombre o número…" />

          <p v-if="!visibles.length" class="vacio">No hay empleados con ese filtro.</p>
          <ul class="lista">
            <li v-for="e in visibles" :key="e.id" :class="{ clic: puedeCorregir }" @click="abrirEdicion(e)">
              <div class="quien">
                <strong>{{ nombre(e) }}</strong>
                <span class="suave">#{{ e.numero_empleado }}<template v-if="e.departamento"> · {{ e.departamento }}</template></span>
              </div>
              <div class="horas">
                <span title="Entrada">⬇ {{ e.marca_entrada || '—' }}</span>
                <span title="Salida">⬆ {{ e.marca_salida || '—' }}</span>
              </div>
              <div class="etiquetas">
                <span class="chip" :class="e.estado">{{ ETIQUETA[e.estado] }}</span>
                <span v-if="e.minutos_retardo > 0" class="chip retardo">+{{ e.minutos_retardo }} min</span>
                <span v-if="e.fuente === 'web' && e.marca_entrada" class="chip suave" title="Marcó desde la web">web</span>
              </div>
            </li>
          </ul>
        </div>

        <aside class="vivo-feed">
          <h2>Movimientos</h2>
          <p v-if="!panel.recientes.length" class="suave">Aquí aparecerán las marcas en cuanto ocurran.</p>
          <ul>
            <li v-for="r in panel.recientes" :key="r.id" :class="r.accion">
              <strong>{{ r.nombre }}</strong>
              marcó {{ r.accion }} a las {{ r.hora_marcada }}
              <span v-if="r.retardo > 0" class="chip retardo">+{{ r.retardo }} min</span>
            </li>
          </ul>
        </aside>
      </div>
    </template>

    <div v-if="edicion" class="modal" @click.self="edicion = null">
      <form class="dialogo" @submit.prevent="guardar">
        <h2>{{ nombre(edicion.empleado) }}</h2>
        <p class="suave">Corrección del {{ datos.fecha }}</p>
        <div class="par">
          <label class="campo"><span>Entrada</span><input v-model="edicion.hora_entrada" type="time" /></label>
          <label class="campo"><span>Salida</span><input v-model="edicion.hora_salida" type="time" /></label>
        </div>
        <label class="campo">
          <span>Estatus</span>
          <select v-model="edicion.estatus">
            <option value="auto">Automático (según horas)</option>
            <option value="asistencia">Asistencia</option>
            <option value="retardo">Retardo</option>
            <option value="falta">Falta</option>
            <option value="permiso">Permiso</option>
            <option value="vacaciones">Vacaciones</option>
            <option value="incapacidad">Incapacidad</option>
            <option value="descanso">Descanso</option>
            <option value="festivo">Festivo</option>
          </select>
        </label>
        <label class="campo"><span>Nota</span><input v-model="edicion.nota" maxlength="500" /></label>
        <p v-if="errorEdicion" class="error" role="alert">{{ errorEdicion }}</p>
        <div class="acciones">
          <button type="button" class="boton peligro" :disabled="guardando || !edicion.empleado.marca_entrada && !edicion.empleado.estatus_dia" @click="quitar">Quitar registro</button>
          <span class="espacio"></span>
          <button type="button" class="boton" @click="edicion = null">Cancelar</button>
          <button class="boton principal" :disabled="guardando">Guardar</button>
        </div>
      </form>
    </div>
  </section>
</template>
