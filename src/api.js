// Cliente de la API. Por omision va al mismo origen (en produccion la API sirve esta web y en
// desarrollo vite hace de proxy, ver vite.config.js). Si la web vive en otro dominio, define
// VITE_API_URL (p. ej. https://api.midominio.com) al compilar y habilita ese origen en CORS_ORIGENES.
export const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export class ErrorApi extends Error {
  constructor(mensaje, estado, codigo, detalle) {
    super(mensaje)
    this.estado = estado
    this.codigo = codigo
    this.detalle = detalle
  }
}

async function pedir(ruta, { metodo = 'GET', cuerpo, token } = {}) {
  let respuesta
  try {
    respuesta = await fetch(BASE + ruta, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    })
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.', 0, 'sin_red')
  }
  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) {
    throw new ErrorApi(datos.mensaje || `Error ${respuesta.status}`, respuesta.status, datos.error, datos.detalle)
  }
  return datos
}

// ---------------------------------------------------------------- marcaje (sin sesión)

export const publico = {
  empresa: (alias) => pedir(`/publico/${encodeURIComponent(alias)}`),
  estado: (alias, credenciales) =>
    pedir(`/publico/${encodeURIComponent(alias)}/estado`, { metodo: 'POST', cuerpo: credenciales }),
  marcar: (alias, tipo, credenciales) =>
    pedir(`/publico/${encodeURIComponent(alias)}/${tipo === 'entrada' ? 'checkin' : 'checkout'}`, {
      metodo: 'POST',
      cuerpo: credenciales
    })
}

// ---------------------------------------------------------------- sesión de RH

const clave = (alias) => `mkrrh:sesion:${alias}`

export function leerSesion(alias) {
  try {
    return JSON.parse(localStorage.getItem(clave(alias)) || 'null')
  } catch {
    return null
  }
}

function guardarSesion(alias, sesion) {
  try {
    if (sesion) localStorage.setItem(clave(alias), JSON.stringify(sesion))
    else localStorage.removeItem(clave(alias))
  } catch {
    /* modo privado: la sesión dura lo que dure la pestaña */
  }
}

export async function iniciarSesion(alias, usuario, password) {
  const d = await pedir('/auth/login', {
    metodo: 'POST',
    cuerpo: { empresa: alias, usuario, password, dispositivo: { nombre: 'Panel web', plataforma: 'web' } }
  })
  const sesion = {
    token: d.token,
    refresh: d.refresh_token,
    usuario: d.usuario,
    empresa: d.empresa,
    permisos: d.permisos
  }
  guardarSesion(alias, sesion)
  return sesion
}

export async function cerrarSesion(alias) {
  const s = leerSesion(alias)
  guardarSesion(alias, null)
  if (s?.refresh) await pedir('/auth/logout', { metodo: 'POST', cuerpo: { refresh_token: s.refresh } }).catch(() => { })
}

let renovando = null

async function renovar(alias) {
  // Varias peticiones que fallan a la vez comparten una sola renovación: el token de refresco
  // se quema al usarse, un segundo intento con el mismo viejo cerraría la sesión.
  renovando ||= (async () => {
    const s = leerSesion(alias)
    if (!s?.refresh) throw new ErrorApi('Sesión expirada', 401, 'no_autenticado')
    try {
      const d = await pedir('/auth/refresh', { metodo: 'POST', cuerpo: { refresh_token: s.refresh } })
      const nueva = { ...s, token: d.token, refresh: d.refresh_token, permisos: d.permisos, usuario: d.usuario }
      guardarSesion(alias, nueva)
      return nueva
    } catch (e) {
      if (e.estado === 401) guardarSesion(alias, null)
      throw e
    } finally {
      renovando = null
    }
  })()
  return renovando
}

/** Petición con sesión; si el token venció lo renueva y reintenta una vez. */
export async function conSesion(alias, ruta, opciones = {}) {
  let s = leerSesion(alias)
  if (!s) throw new ErrorApi('Inicia sesión', 401, 'no_autenticado')
  try {
    return await pedir(ruta, { ...opciones, token: s.token })
  } catch (e) {
    if (e.estado !== 401) throw e
    s = await renovar(alias)
    return pedir(ruta, { ...opciones, token: s.token })
  }
}

export const panel = {
  hoy: (alias, fecha) => conSesion(alias, `/panel/hoy${fecha ? `?fecha=${fecha}` : ''}`),
  historial: (alias, { desde, hasta, empleado_id }) =>
    conSesion(
      alias,
      `/panel/asistencia?desde=${desde}&hasta=${hasta}${empleado_id ? `&empleado_id=${empleado_id}` : ''}`
    ),
  corregir: (alias, empleadoId, fecha, cuerpo) =>
    conSesion(alias, `/panel/asistencia/${empleadoId}/${fecha}`, { metodo: 'PUT', cuerpo }),
  quitar: (alias, empleadoId, fecha) =>
    conSesion(alias, `/panel/asistencia/${empleadoId}/${fecha}`, { metodo: 'DELETE' }),
  empleados: (alias) => conSesion(alias, '/panel/empleados'),
  crearEmpleado: (alias, cuerpo) => conSesion(alias, '/panel/empleados', { metodo: 'POST', cuerpo }),
  actualizarEmpleado: (alias, id, cuerpo) =>
    conSesion(alias, `/panel/empleados/${id}`, { metodo: 'PATCH', cuerpo }),
  asignarPin: (alias, id, pin) => conSesion(alias, `/panel/empleados/${id}/pin`, { metodo: 'POST', cuerpo: { pin } })
}

export function puedeEscribir(sesion, entidad) {
  return !!sesion?.permisos?.escritura?.includes(entidad)
}
