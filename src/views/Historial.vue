<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { panel as api } from '../api.js'

const panel = inject('panel')
const alias = panel.alias

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const hoy = new Date()
const hace7 = new Date(hoy.getTime() - 6 * 86_400_000)

const desde = ref(iso(hace7))
const hasta = ref(iso(hoy))
const empleadoId = ref('')
const empleados = ref([])
const registros = ref([])
const cargando = ref(false)
const error = ref('')

const nombre = (r) => [r.nombre, r.apellido_paterno, r.apellido_materno].filter(Boolean).join(' ')

async function buscar() {
  cargando.value = true
  error.value = ''
  try {
    const d = await api.historial(alias.value, {
      desde: desde.value,
      hasta: hasta.value,
      empleado_id: empleadoId.value || undefined
    })
    registros.value = d.registros
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const totales = computed(() => ({
  dias: registros.value.length,
  horas: registros.value.reduce((s, r) => s + Number(r.horas || 0), 0),
  extra: registros.value.reduce((s, r) => s + Number(r.horas_extra || 0), 0),
  retardos: registros.value.filter((r) => r.minutos_retardo > 0).length
}))

function csv() {
  const celdas = (f) => f.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  const filas = [
    celdas(['Fecha', 'Número', 'Empleado', 'Entrada', 'Salida', 'Horas', 'Retardo (min)', 'Horas extra', 'Estatus', 'Origen', 'Nota']),
    ...registros.value.map((r) =>
      celdas([r.fecha, r.numero_empleado, nombre(r), r.hora_entrada, r.hora_salida, r.horas, r.minutos_retardo, r.horas_extra, r.estatus, r.fuente, r.nota])
    )
  ]
  // BOM para que Excel abra bien los acentos.
  const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `asistencia_${desde.value}_${hasta.value}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

onMounted(async () => {
  try {
    empleados.value = (await api.empleados(alias.value)).empleados
  } catch {
    /* el filtro por empleado es opcional */
  }
  buscar()
})
</script>

<template>
  <section>
    <div class="encabezado"><h1>Historial</h1></div>

    <form class="filtros" @submit.prevent="buscar">
      <label class="campo"><span>Desde</span><input v-model="desde" type="date" required /></label>
      <label class="campo"><span>Hasta</span><input v-model="hasta" type="date" required /></label>
      <label class="campo">
        <span>Empleado</span>
        <select v-model="empleadoId">
          <option value="">Todos</option>
          <option v-for="e in empleados" :key="e.id" :value="e.id">{{ e.apellido_paterno }} {{ e.nombre }}</option>
        </select>
      </label>
      <button class="boton principal" :disabled="cargando">Buscar</button>
      <button type="button" class="boton" :disabled="!registros.length" @click="csv">Descargar CSV</button>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <div class="resumen fijo">
      <span><b>{{ totales.dias }}</b> registros</span>
      <span><b>{{ totales.horas.toFixed(1) }}</b> horas</span>
      <span><b>{{ totales.extra.toFixed(1) }}</b> extra</span>
      <span><b>{{ totales.retardos }}</b> retardos</span>
    </div>

    <p v-if="!registros.length && !cargando" class="vacio">Sin registros en ese periodo.</p>
    <div class="tabla-caja" v-else>
      <table>
        <thead>
          <tr><th>Fecha</th><th>Empleado</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Retardo</th><th>Estatus</th><th>Origen</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in registros" :key="r.id">
            <td>{{ r.fecha }}</td>
            <td>{{ nombre(r) }} <span class="suave">#{{ r.numero_empleado }}</span></td>
            <td>{{ r.hora_entrada || '—' }}</td>
            <td>{{ r.hora_salida || '—' }}</td>
            <td>{{ r.horas }}</td>
            <td><span v-if="r.minutos_retardo > 0" class="chip retardo">+{{ r.minutos_retardo }} min</span><template v-else>—</template></td>
            <td><span class="chip" :class="r.estatus">{{ r.estatus }}</span></td>
            <td class="suave">{{ r.fuente === 'web' ? 'Web' : 'Escritorio' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
