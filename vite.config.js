import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Dev: phục vụ dist/modules/*.zip (tạo bằng `npm run build:modules`) cho nút "Tải module"
const serveModuleZips = () => ({
  name: 'serve-module-zips',
  configureServer(server) {
    server.middlewares.use('/modules', (req, res, next) => {
      const name = decodeURIComponent((req.url || '').split('?')[0].replace(/^\//, ''))
      if (!/^[a-z0-9-]+-\d+\.\d+\.\d+\.zip$/.test(name)) return next()
      const file = join(server.config.root, 'dist', 'modules', name)
      if (!existsSync(file)) {
        res.statusCode = 404
        return res.end('Chưa có file module — chạy "npm run build:modules" trước.')
      }
      res.setHeader('Content-Type', 'application/zip')
      res.end(readFileSync(file))
    })
  },
})

export default defineConfig({
  base: './', // Bắt buộc khi Electron load bằng file://
  plugins: [react(), tailwindcss(), serveModuleZips()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // Bản app thường: không phải module App FPT-IS (xem scripts/build-modules.mjs)
    __IOC_MODULE__: 'false',
    __IOC_MODULE_ID__: '""',
  },
  server: {
    open : true,
    proxy: {
      '/api-eioc': {
        target: 'https://iocthads.moj.gov.vn/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-eioc/, ''),
      },
      '/api-auth': {
        target: 'https://eaccount.kyta.fpt.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-auth/, ''),
      },
      '/api-eaccount': {
        target: 'https://eaccount.kyta.fpt.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-eaccount/, ''),
      }
    }
  }
})
