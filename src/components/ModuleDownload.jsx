import { useEffect, useRef, useState } from 'react'
import { Package, Download, Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { MODULES, moduleZipName } from '../modules/registry'

/* ══════════════ Nút tải module zip cho App FPT-IS ══════════════ */
// Zip do scripts/build-modules.mjs tạo sẵn lúc build (dist/modules/).
// Electron (file://) lưu qua IPC + hộp thoại "Lưu thành"; trình duyệt tải trực tiếp.
const VERSION = __APP_VERSION__

export default function ModuleDownload() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState({}) // id → 'busy' | { ok, msg }
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const flash = (id, ok, msg) => {
    setStatus((p) => ({ ...p, [id]: { ok, msg } }))
    setTimeout(() => setStatus((p) => ({ ...p, [id]: undefined })), 4000)
  }

  const download = async (mod) => {
    const file = moduleZipName(mod.id, VERSION)
    setStatus((p) => ({ ...p, [mod.id]: 'busy' }))
    try {
      if (window.location.protocol === 'file:' && window.electronAPI?.saveModule) {
        const r = await window.electronAPI.saveModule(file)
        if (r?.ok) flash(mod.id, true, 'Đã lưu')
        else if (r?.canceled) setStatus((p) => ({ ...p, [mod.id]: undefined }))
        else flash(mod.id, false, r?.reason ?? 'Không lưu được')
        return
      }
      const res = await fetch(`./modules/${file}`)
      if (!res.ok) throw new Error(res.status === 404 ? 'Chưa build module (npm run build:modules)' : `HTTP ${res.status}`)
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = file
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      flash(mod.id, true, 'Đã tải')
    } catch (e) {
      flash(mod.id, false, e?.message ?? 'Không tải được')
    }
  }

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        title="Tải các chức năng dưới dạng module zip cho App FPT-IS"
        className={`flex items-center gap-2 border px-3 py-2 text-[11px] font-semibold tracking-wider uppercase ${
          open ? 'border-gov-gold bg-gov-gold/15 text-gov-gold' : 'border-white/20 text-white/80 hover:border-gov-gold hover:text-gov-gold'
        }`}
      >
        <Package className="h-4 w-4" />
        <span className="hidden lg:inline">Tải module</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[90vw] border border-gov-navy bg-white text-gov-slate shadow-2xl">
          <div className="border-b-2 border-gov-gold bg-gov-navy px-4 py-2.5">
            <p className="text-xs font-bold tracking-wider text-white uppercase">Module App FPT-IS</p>
            <p className="text-[11px] text-white/60">Mỗi file zip: manifest.json · index.js · index.css · main.js — v{VERSION}</p>
          </div>
          {MODULES.map((mod) => {
            const s = status[mod.id]
            const busy = s === 'busy'
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => download(mod)}
                disabled={busy}
                className="flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-gov-navy/5 disabled:cursor-wait"
              >
                <span className="mt-0.5 shrink-0 text-gov-navy">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" />
                    : s?.ok === false ? <XCircle className="h-4 w-4 text-red-700" />
                      : s?.ok ? <CheckCircle2 className="h-4 w-4 text-green-700" />
                        : <Download className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gov-navy">{mod.name}</span>
                  <span className="block truncate font-mono text-[11px] text-gray-500">{moduleZipName(mod.id, VERSION)}</span>
                  {s && !busy && (
                    <span className={`block text-[11px] ${s.ok ? 'text-green-700' : 'text-red-700'}`}>{s.msg}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
