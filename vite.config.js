import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// En desarrollo la web habla con la API por el mismo origen (proxy), asi que no hace falta CORS
// y las URLs son las mismas que en produccion, donde la API sirve esta carpeta compilada.
const API = process.env.VITE_API || 'http://127.0.0.1:3000'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/publico': API,
      '/auth': API,
      '/panel': API,
      '/ws': { target: API, ws: true }
    }
  }
})
