import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MODULE_ID, ipc } from './transport'

/* ══════════════ Khung module: tiêu đề + tab con ══════════════ */
export function ModuleShell({ title, subtitle, icon: Icon, tabs }) {
  const [tab, setTab] = useState(tabs[0].id)
  const Active = tabs.find((t) => t.id === tab).component
  return (
    <div className="ioc-module flex h-full min-h-[640px] flex-col overflow-hidden bg-gov-bg">
      <div className="flex shrink-0 items-center gap-3 border-b border-gov-gold/40 bg-gov-navy-deep px-4 py-2.5 text-white">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-gov-gold/70 bg-gov-navy">
          <Icon className="h-5 w-5 text-gov-gold" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold tracking-wide uppercase">{title}</h1>
          {subtitle && <p className="truncate text-[10px] tracking-wider text-white/50 uppercase">{subtitle}</p>}
        </div>
        {tabs.length > 1 && (
          <nav className="ml-auto flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`border px-3.5 py-2 text-[11px] font-semibold tracking-wider uppercase ${
                  tab === t.id
                    ? 'border-gov-gold bg-gov-gold/15 text-gov-gold'
                    : 'border-transparent text-white/70 hover:border-white/20 hover:bg-white/5 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Active />
      </div>
    </div>
  )
}

/* ══════════════ Gắn module vào vùng hiển thị của App FPT-IS ══════════════ */
export function mountModule(element) {
  const el = window.moduleMountPoints?.[MODULE_ID]
    || document.getElementById('dynamicModulesArea')
    || document.getElementById('root')
  if (!el) return
  const root = createRoot(el)
  root.render(element)
  window.loadedModules = window.loadedModules || {}
  window.loadedModules[MODULE_ID] = {
    unload() {
      try {
        ipc?.invoke('module-backend-terminate', MODULE_ID).catch(() => {})
        root.unmount()
        el.innerHTML = ''
      } catch { /* app chủ đã gỡ vùng hiển thị */ }
    },
  }
}
