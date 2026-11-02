<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { panel as api, puedeEscribir } from '../api.js'

const panel = inject('panel')
const alias = panel.alias

const empleados = ref([])
const cargando = ref(true)
const error = ref('')
const q = ref('')

const puedeEditar = computed(() => puedeEscribir(panel.sesion.value, 'empleados'))

const nombre = (e) => [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ')

const visibles = computed(() => {
  const t = q.value.trim().toLowerCase()
  return empleados.value.filter((e) => !t || `${e.numero_empleado} ${nombre(e)}`.toLowerCase().includes(t))
})

async function cargar() {
  cargando.value = true
  try {
    empleados.value = (await api.empleados(alias.value)).empleados
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

// -------------------------------------------------------------- alta
const nuevo = ref(null)
const errorForm = ref('')
const guardando = ref(false)

function abrirNuevo() {
  errorForm.value = ''
  nuevo.value = { numero_empleado: '', nombre: '', apellido_paterno: '', apellido_materno: '', hora_entrada: '09:00', hora_salida: '18:00', pin: '' }
}

function pinAleatorio() {
  const n = new Uint32Array(1)
  crypto.getRandomValues(n)
  return String(n[0] % 1_000_000).padStart(6, '0')
}

async function crear() {
  guardando.value = true
  errorForm.value = ''
  try {
    const cuerpo = { ...nuevo.value }
    if (!cuerpo.apellido_materno) delete cuerpo.apellido_materno
    await api.crearEmpleado(alias.value, cuerpo)
    pinMostrado.value = { nombre: `${cuerpo.nombre} ${cuerpo.apellido_paterno}`, pin: cuerpo.pin }
    nuevo.value = null
    await cargar()
  } catch (e) {
    errorForm.value = e.detalle ? `${e.message}` : e.message
  } finally {
    guardando.value = false
  }
}

// -------------------------------------------------------------- PIN
const pinDe = ref(null)
const pinNuevo = ref('')
const pinMostrado = ref(null) // se muestra una sola vez: el servidor solo guarda su hash

async function asignarPin() {
  guardando.value = true
  errorForm.value = ''
  try {
    await api.asignarPin(alias.value, pinDe.value.id, pinNuevo.value)
    pinMostrado.value = { nombre: nombre(pinDe.value), pin: pinNuevo.value }
    pinDe.value = null
    await cargar()
  } catch (e) {
    errorForm.value = e.message
  } finally {
    guardando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <section>
    <div class="encabezado">
      <h1>Empleados <small>{{ empleados.length }}</small></h1>
      <button v-if="puedeEditar" class="boton principal" @click="abrirNuevo">+ Nuevo empleado</button>
    </div>

    <p class="suave">
      El PIN es lo que cada empleado usa para marcar en <code>/{{ alias }}</code>. Sueldo, CURP y nómina
      se administran solo en la aplicación de escritorio.
    </p>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <input v-model="q" class="buscar" type="search" placeholder="Buscar por nombre o número…" />
    <p v-if="cargando" class="suave">Cargando…</p>

    <ul class="lista">
      <li v-for="e in visibles" :key="e.id">
        <div class="quien">
          <strong>{{ nombre(e) }}</strong>
          <span class="suave">#{{ e.numero_empleado }}<template v-if="e.departamento"> · {{ e.departamento }}</template><template v-if="e.puesto"> · {{ e.puesto }}</template></span>
        </div>
        <div class="horas"><span>{{ e.hora_entrada || '—' }} – {{ e.hora_salida || '—' }}</span></div>
        <div class="etiquetas">
          <span class="chip" :class="e.estatus === 'activo' ? 'completo' : 'sin_marcar'">{{ e.estatus }}</span>
          <span class="chip" :class="e.tiene_pin ? 'dentro' : 'retardo'">{{ e.tiene_pin ? 'PIN activo' : 'Sin PIN' }}</span>
          <button v-if="puedeEditar" class="boton chico" @click="(pinDe = e), (pinNuevo = pinAleatorio()), (errorForm = '')">
            {{ e.tiene_pin ? 'Cambiar PIN' : 'Dar PIN' }}
          </button>
        </div>
      </li>
    </ul>

    <!-- Alta -->
    <div v-if="nuevo" class="modal" @click.self="nuevo = null">
      <form class="dialogo" @submit.prevent="crear">
        <h2>Nuevo empleado</h2>
        <label class="campo"><span>Número de empleado</span><input v-model="nuevo.numero_empleado" required maxlength="40" /></label>
        <div class="par">
          <label class="campo"><span>Nombre(s)</span><input v-model="nuevo.nombre" required /></label>
          <label class="campo"><span>Apellido paterno</span><input v-model="nuevo.apellido_paterno" required /></label>
        </div>
        <label class="campo"><span>Apellido materno</span><input v-model="nuevo.apellido_materno" /></label>
        <div class="par">
          <label class="campo"><span>Entrada</span><input v-model="nuevo.hora_entrada" type="time" /></label>
          <label class="campo"><span>Salida</span><input v-model="nuevo.hora_salida" type="time" /></label>
        </div>
        <label class="campo">
          <span>PIN de marcaje (4 a 8 dígitos)</span>
          <div class="con-boton">
            <input v-model="nuevo.pin" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" />
            <button type="button" class="boton chico" @click="nuevo.pin = pinAleatorio()">Generar</button>
          </div>
        </label>
        <p v-if="errorForm" class="error" role="alert">{{ errorForm }}</p>
        <div class="acciones">
          <span class="espacio"></span>
          <button type="button" class="boton" @click="nuevo = null">Cancelar</button>
          <button class="boton principal" :disabled="guardando">Crear</button>
        </div>
      </form>
    </div>

    <!-- Cambio de PIN -->
    <div v-if="pinDe" class="modal" @click.self="pinDe = null">
      <form class="dialogo" @submit.prevent="asignarPin">
        <h2>PIN de {{ nombre(pinDe) }}</h2>
        <label class="campo">
          <span>Nuevo PIN (4 a 8 dígitos)</span>
          <div class="con-boton">
            <input v-model="pinNuevo" inputmode="numeric" pattern="[0-9]{4,8}" maxlength="8" required />
            <button type="button" class="boton chico" @click="pinNuevo = pinAleatorio()">Generar</button>
          </div>
        </label>
        <p v-if="errorForm" class="error" role="alert">{{ errorForm }}</p>
        <div class="acciones">
          <span class="espacio"></span>
          <button type="button" class="boton" @click="pinDe = null">Cancelar</button>
          <button class="boton principal" :disabled="guardando">Guardar PIN</button>
        </div>
      </form>
    </div>

    <!-- PIN recién asignado: única vez que se ve -->
    <div v-if="pinMostrado" class="modal" @click.self="pinMostrado = null">
      <div class="dialogo">
        <h2>Entrégalo ahora</h2>
        <p>PIN de <strong>{{ pinMostrado.nombre }}</strong>:</p>
        <p class="pin-grande">{{ pinMostrado.pin || '(sin PIN)' }}</p>
        <p class="suave">Por seguridad no se vuelve a mostrar: el servidor solo guarda su huella.</p>
        <div class="acciones"><span class="espacio"></span><button class="boton principal" @click="pinMostrado = null">Entendido</button></div>
      </div>
    </div>
  </section>
</template>
