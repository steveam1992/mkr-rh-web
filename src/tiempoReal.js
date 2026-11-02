import { BASE, conSesion, leerSesion } from './api.js'

// Canal en vivo del panel. Se autentica con el primer mensaje (el token no viaja en la URL)
// y se reconecta solo con espera creciente; si se cae, el panel sigue funcionando con recargas.

// En Vercel la API no admite WebSocket: con VITE_TIEMPO_REAL=sondeo el panel se refresca solo cada
// pocos segundos. Se emite un evento 'sync' y cada pantalla recarga sus datos como si hubiera llegado uno.
const SONDEO = import.meta.env.VITE_TIEMPO_REAL === 'sondeo'
const SONDEO_MS = Number(import.meta.env.VITE_SONDEO_MS) || 10_000

function sondear(alias, { alEvento, alEstado }) {
  let activo = true
  alEstado?.('conectado')
  const temporizador = setInterval(async () => {
    if (document.hidden) return // pestaña en segundo plano: no gastar peticiones
    try {
      await conSesion(alias, '/panel/catalogos') // renueva el token si venció
      alEvento?.({ tipo: 'sync', sondeo: true, hora: new Date().toISOString() })
      if (activo) alEstado?.('conectado')
    } catch {
      alEstado?.('desconectado')
    }
  }, SONDEO_MS)
  return () => {
    activo = false
    clearInterval(temporizador)
  }
}

export function conectarTiempoReal(alias, { alEvento, alEstado }) {
  if (SONDEO) return sondear(alias, { alEvento, alEstado })
  let socket = null
  let activo = true
  let espera = 1000
  let temporizador = null

  async function abrir() {
    if (!activo) return
    alEstado?.('conectando')
    let token
    try {
      // Una llamada cualquiera con sesión renueva el token si ya venció.
      await conSesion(alias, '/panel/catalogos')
      token = leerSesion(alias)?.token
    } catch {
      alEstado?.('desconectado')
      return reintentar()
    }
    if (!token || !activo) return

    const url = (BASE || location.origin).replace(/^http/, 'ws') + '/ws'
    const ws = new WebSocket(url)
    socket = ws

    ws.onopen = () => ws.send(JSON.stringify({ tipo: 'auth', token }))
    ws.onmessage = (m) => {
      let e
      try {
        e = JSON.parse(m.data)
      } catch {
        return
      }
      if (e.tipo === 'listo') {
        espera = 1000
        alEstado?.('conectado')
      }
      alEvento?.(e)
    }
    ws.onclose = () => {
      socket = null
      alEstado?.('desconectado')
      reintentar()
    }
    ws.onerror = () => {}
  }

  function reintentar() {
    if (!activo) return
    clearTimeout(temporizador)
    temporizador = setTimeout(abrir, espera)
    espera = Math.min(espera * 2, 30_000)
  }

  abrir()

  return () => {
    activo = false
    clearTimeout(temporizador)
    try {
      socket?.close(1000)
    } catch {
      /* ya cerrado */
    }
  }
}
