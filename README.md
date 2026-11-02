# MKR RH Web

Vue 3 + Vite. Dos cosas, ambas por empresa (el alias va en la URL):

| URL | Para quién | Qué hace |
| --- | --- | --- |
| `/` | Cualquiera | Pide el identificador de la empresa |
| `/empresa-pescadera` | Empleados (celular o tablet) | Check-in / check-out con número de empleado + PIN, en dos pasos para no marcar lo contrario por error |
| `/empresa-pescadera/admin` | RH | Login → **Hoy** (plantilla en vivo, corrección manual), **Historial** (filtros + CSV), **Empleados** (alta y PIN) |

El panel se actualiza solo por WebSocket cuando alguien marca, sin recargar. Nunca muestra sueldos ni
datos fiscales: eso vive solo en la app de escritorio.

## Desarrollo

```bash
pnpm install
pnpm dev        # http://localhost:5173/empresa-pescadera  (proxy a la API en :3000, ver VITE_API)
pnpm build      # genera dist/
```

En producción **no hay que desplegarla aparte**: la API ([`../mkr-rh-api`](../mkr-rh-api)) sirve `dist/`
(`WEB_DIR`) y reescribe `/:alias` a `index.html`, así que web y API comparten origen.

## Web en otro dominio que la API

Por omisión las peticiones y el WebSocket van al mismo origen que la página. Si la sirves aparte
(Vercel, Netlify, otro dominio), compila con la dirección de la API y agrega el origen de la web a
`CORS_ORIGENES` en la API:

```bash
VITE_API_URL=https://api.midominio.com pnpm build
```
