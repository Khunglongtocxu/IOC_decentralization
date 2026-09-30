/* ══════════════ Đóng gói các chức năng thành module zip cho App FPT-IS ══════════════ */
// Chạy sau `vite build` (npm run build): mỗi module trong src/modules/registry.js →
//   dist/modules/<id>-<version>.zip  gồm  manifest.json · index.js · index.css · main.js
// index.js là bundle IIFE (đã kèm React), main.js là backend Node dùng chung.
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { zipSync } from 'fflate'
import { MODULES, MODULE_META, moduleZipName } from '../src/modules/registry.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const outDir = join(root, 'dist', 'modules')
const tmpRoot = join(root, 'node_modules', '.cache', 'ioc-modules')
const backend = readFileSync(join(root, 'src', 'modules', 'backend', 'main.cjs'))

// Lọc theo id nếu truyền tham số: node scripts/build-modules.mjs ioc-phan-quyen-chi-so
const only = process.argv.slice(2)
const targets = only.length ? MODULES.filter((m) => only.includes(m.id)) : MODULES

mkdirSync(outDir, { recursive: true })

for (const mod of targets) {
  const tmp = join(tmpRoot, mod.id)
  rmSync(tmp, { recursive: true, force: true })

  await build({
    configFile: false,
    root,
    logLevel: 'warn',
    plugins: [react(), tailwindcss()],
    define: {
      __IOC_MODULE__: 'true',
      __IOC_MODULE_ID__: JSON.stringify(mod.id),
      __APP_VERSION__: JSON.stringify(version),
      // Chế độ lib của Vite không tự thay → React sẽ đọc process.env lúc chạy
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: tmp,
      emptyOutDir: true,
      copyPublicDir: false,
      cssCodeSplit: false,
      lib: {
        entry: join(root, mod.entry),
        name: mod.globalName,
        formats: ['iife'],
        fileName: () => 'index.js',
        cssFileName: 'index',
      },
    },
  })

  for (const f of ['index.js', 'index.css']) {
    if (!existsSync(join(tmp, f))) throw new Error(`${mod.id}: build không sinh ra ${f}`)
  }

  const manifest = {
    moduleId: mod.id,
    moduleName: mod.name,
    version,
    description: mod.description,
    icon: mod.icon,
    ...MODULE_META,
  }

  const zip = zipSync({
    'manifest.json': Buffer.from(JSON.stringify(manifest, null, 2) + '\n'),
    'index.js': readFileSync(join(tmp, 'index.js')),
    'index.css': readFileSync(join(tmp, 'index.css')),
    'main.js': backend,
  }, { level: 9 })

  const file = moduleZipName(mod.id, version)
  writeFileSync(join(outDir, file), zip)
  console.log(`✔ ${file}  (${(zip.length / 1024).toFixed(0)} KB)`)
}
