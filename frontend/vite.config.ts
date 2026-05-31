import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@core": path.resolve(__dirname, "src/core"),
        "@admin": path.resolve(__dirname, "src/admin"),
      },
    },
    server: {
      port: 5174,
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL || "http://127.0.0.1:8002",
          changeOrigin: true,
          secure: false,
        },
        "/ws": {
          target: env.VITE_WS_BASE_URL || "ws://127.0.0.1:8002",
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      chunkSizeWarningLimit: 600,
    },
    preview: { port: 4173 },
  }
})
