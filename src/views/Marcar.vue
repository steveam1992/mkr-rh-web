<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { publico } from '../api.js'

// Marcaje de entrada y salida. Dos pasos para evitar marcar lo contrario por error:
//   1. número de empleado + PIN  ->  la página dice quién eres y qué toca hacer
//   2. un solo botón grande (Entrada o Salida, según tu día)  ->  confirmación

const route = useRoute()
const alias = computed(() => route.params.alias)

const empresa = ref(null)
const noExiste = ref(false)
const cargando = ref(true)

const numero = ref('')
const pin = ref('')
const paso = ref('credenciales') // credenciales | listo | hecho
const ocupado = ref(false)
const error = ref('')
const persona = ref(null)
const dia = ref(null)
const resultado = ref(null)

// Reloj: arranca con el instante del servidor, se muestra en la zona de la empresa y avanza solo.
const offset = ref(0)
const ahora = ref(new Date())
let reloj
let reinicio

const claveNumero = computed(() => `mkrrh:numero:${alias.value}`)

const horaTexto = computed(() => {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: empresa.value?.zona_horaria,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date(ahora.value.getTime() + offset.value))
  } catch {
    return ''
  }
})
const fechaTexto = computed(() => {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: empresa.value?.zona_horaria,
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(new Date(ahora.value.getTime() + offset.value))
  } catch {
    return ''
  }
})

async function cargar() {
  cargando.value = true
  noExiste.value = false
  empresa.value = null
  try {
    const d = await publico.empresa(alias.value)
    empresa.value = { ...d.empresa, checkin_web: d.checkin_web, zona_horaria: d.zona_horaria }
    document.title = `${d.empresa.nombre} · Marcaje`
    // El reloj se rige por el servidor, no por el del celular: si ese esta mal, el marcaje no miente.
    offset.value = Date.parse(d.instante) - Date.now()
  } catch (e) {
    if (e.estado === 404) noExiste.value = true
    else error.value = e.message
  } finally {
    cargando.value = false
  }
}

function reiniciar() {
  clearTimeout(reinicio)
  paso.value = 'credenciales'
  pin.value = ''
  error.value = ''
  persona.value = null
  dia.value = null
  resultado.value = null
}

const MENSAJES = {
  credenciales: 'Número de empleado o PIN incorrectos.',
  sin_pin: 'Tu PIN todavía no está activado. Pídelo a RH.',
  bloqueado: null, // el servidor ya dice cuántos minutos
  checkin_deshabilitado: 'El marcaje por web está desactivado en esta empresa.'
}

function mostrarError(e) {
  error.value = MENSAJES[e.codigo] ?? e.message
}

async function continuar() {
  if (ocupado.value) return
  error.value = ''
  ocupado.value = true
  try {
    const d = await publico.estado(alias.value, { numero_empleado: numero.value.trim(), pin: pin.value })
    persona.value = d.empleado
    dia.value = d
    try {
      localStorage.setItem(claveNumero.value, numero.value.trim())
    } catch {
      /* modo privado */
    }
    paso.value = 'listo'
  } catch (e) {
    mostrarError(e)
    pin.value = ''
  } finally {
    ocupado.value = false
  }
}

const accion = computed(() => (dia.value?.estado === 'dentro' ? 'salida' : 'entrada'))
const bloqueadoHoy = computed(() => dia.value?.estado === 'completo' || dia.value?.estado === 'bloqueado')

async function marcar() {
  if (ocupado.value) return
  error.value = ''
  ocupado.value = true
  try {
    resultado.value = await publico.marcar(alias.value, accion.value, {
      numero_empleado: numero.value.trim(),
      pin: pin.value
    })
    paso.value = 'hecho'
    // En una tablet compartida la siguiente persona no debe ver nada de la anterior.
    reinicio = setTimeout(reiniciar, 9000)
  } catch (e) {
    mostrarError(e)
    if (['ya_marco_entrada', 'jornada_completa', 'sin_entrada', 'dia_bloqueado'].includes(e.codigo)) {
      // El día cambió desde que se consultó: se vuelve a leer y se muestra el estado real.
      try {
        dia.value = await publico.estado(alias.value, { numero_empleado: numero.value.trim(), pin: pin.value })
      } catch {
        /* el mensaje de arriba ya lo explica */
      }
    }
  } finally {
    ocupado.value = false
  }
}

const textoDia = computed(() => {
  const d = dia.value
  if (!d) return ''
  if (d.estado === 'dentro') return `Entraste a las ${d.entrada}. ¿Terminas tu jornada?`
  if (d.estado === 'completo') return `Hoy ya registraste tu jornada: ${d.entrada} a ${d.salida}.`
  if (d.estado === 'bloqueado') return `Hoy tienes ${d.estatus} registrada. Habla con RH si vas a trabajar.`
  return 'Todavía no has marcado entrada hoy.'
})

const aviso = computed(() => {
  const r = resultado.value
  if (!r) return ''
  if (r.tipo === 'entrada') return r.retardo > 0 ? `Llegaste con ${r.retardo} min de retardo.` : 'Llegaste a tiempo.'
  return `Trabajaste ${r.horas} h hoy.`
})

watch(alias, () => {
  reiniciar()
  numero.value = ''
  cargar()
})

onMounted(() => {
  try {
    numero.value = localStorage.getItem(claveNumero.value) || ''
  } catch {
    /* modo privado */
  }
  reloj = setInterval(() => (ahora.value = new Date()), 1000)
  cargar()
})
onBeforeUnmount(() => {
  clearInterval(reloj)
  clearTimeout(reinicio)
})
</script>

<template>
  <main class="centro">
    <section v-if="cargando" class="tarjeta"><p class="suave">Cargando…</p></section>

    <section v-else-if="noExiste" class="tarjeta">
      <div class="logo malo" aria-hidden="true">?</div>
      <h1>No encontramos esa empresa</h1>
      <p class="suave">
        Revisa el enlace: <code>/{{ alias }}</code> no corresponde a ninguna empresa activa.
      </p>
      <router-link class="boton" to="/">Probar con otro identificador</router-link>
    </section>

    <section v-else-if="!empresa" class="tarjeta">
      <p class="error" role="alert">{{ error }}</p>
      <button class="boton" @click="cargar">Reintentar</button>
    </section>

    <section v-else class="tarjeta">
      <p class="empresa">{{ empresa.nombre }}</p>
      <p class="reloj" aria-live="off">{{ horaTexto }}</p>
      <p class="suave fecha">{{ fechaTexto }}</p>

      <p v-if="!empresa.checkin_web" class="error" role="alert">
        El marcaje por web está desactivado. Usa el reloj o pregunta a RH.
      </p>

      <!-- Paso 1 -->
      <form v-else-if="paso === 'credenciales'" @submit.prevent="continuar">
        <label class="campo">
          <span>Número de empleado</span>
          <input v-model="numero" inputmode="text" autocomplete="username" autocapitalize="characters" required />
        </label>
        <label class="campo">
          <span>PIN</span>
          <input
            v-model="pin"
            type="password"
            inputmode="numeric"
            pattern="[0-9]{4,8}"
            maxlength="8"
            autocomplete="current-password"
            required
          />
        </label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="boton principal" :disabled="ocupado || !numero.trim() || pin.length < 4">
          {{ ocupado ? 'Verificando…' : 'Continuar' }}
        </button>
      </form>

      <!-- Paso 2 -->
      <div v-else-if="paso === 'listo'">
        <p class="saludo">Hola, <strong>{{ persona.nombre }}</strong></p>
        <p class="suave">{{ textoDia }}</p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button
          v-if="!bloqueadoHoy"
          class="boton gigante"
          :class="accion"
          :disabled="ocupado"
          @click="marcar"
        >
          {{ ocupado ? 'Registrando…' : accion === 'entrada' ? 'Marcar ENTRADA' : 'Marcar SALIDA' }}
        </button>
        <button class="boton secundario" @click="reiniciar">No soy yo / Cancelar</button>
      </div>

      <!-- Hecho -->
      <div v-else class="hecho" role="status">
        <div class="logo" :class="{ aviso: resultado.retardo > 0 }" aria-hidden="true">✓</div>
        <h2>{{ resultado.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada' }}</h2>
        <p class="grande">{{ resultado.hora }}</p>
        <p>{{ resultado.empleado.nombre }}</p>
        <p class="suave">{{ aviso }}</p>
        <button class="boton secundario" @click="reiniciar">Listo</button>
      </div>

      <p class="pie">
        <router-link :to="{ name: 'login', params: { alias } }">Acceso RH</router-link>
      </p>
    </section>
  </main>
</template>
