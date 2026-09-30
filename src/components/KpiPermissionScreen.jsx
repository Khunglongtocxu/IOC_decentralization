import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  ShieldCheck, ScrollText, Copy, Trash2, AlertTriangle, Search,
  Activity, Mail, RefreshCw, XCircle, CheckCircle2, Folder, FolderOpen,
  ChevronRight, ChevronDown, ListTree, ChevronsDownUp, ChevronsUpDown, X,
} from 'lucide-react'
import apiClient from '../api/axiosConfig'
import { ConfirmDialog, ToastStack } from './ReportPermissionScreen'

/* ══════════════ Phân quyền chỉ số (ACL ioc-metadata kpi-types) ══════════════ */
// Danh mục:  GET  /services/ioc-metadata/api/category-kpis
// Cấp quyền: POST /services/ioc-metadata/api/kpi-types/acl?kpiTypeId=<id>
//            body [{ assigneeId, assignee, perm, permType: 0 }, ...]
const ROLES = [
  { value: 'e', label: 'Người chỉnh sửa', perm: 'Perm: e' },
  { value: 'v', label: 'Người xem', perm: 'Perm: v' },
]

const INIT_LOGS = [
  { time: '09:00:00', type: 'info', msg: 'Sẵn sàng. Danh mục chỉ số được tải trực tiếp từ hệ thống.' },
]

const CONCURRENCY = 5

// Chưa có mẫu phản hồi của category-kpis → dò lần lượt các tên trường hay gặp
const CATEGORY_KPI_KEYS = ['kpiTypes', 'kpiTypeList', 'listKpiType', 'lstKpiType', 'kpiTypeDTOs', 'kpis', 'kpiList', 'children', 'items']
const NODE_CHILD_KEYS = ['children', 'childs', 'childKpiTypes', 'subKpiTypes', 'subKpis', 'kpiTypes', 'items']

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

const now = () => {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

const firstArray = (o, keys) => {
  for (const k of keys) if (Array.isArray(o?.[k])) return o[k]
  return null
}

function toNode(raw) {
  const kids = firstArray(raw, NODE_CHILD_KEYS) ?? []
  return {
    id: String(raw?.id ?? raw?.kpiTypeId ?? ''),
    name: raw?.name ?? raw?.kpiTypeName ?? raw?.title ?? raw?.code ?? '(không tên)',
    code: raw?.code ?? raw?.kpiCode ?? raw?.kpiTypeCode ?? '',
    parentId: raw?.parentId ?? raw?.parentKpiTypeId ?? raw?.parent?.id ?? null,
    children: kids.map(toNode),
  }
}

// Danh sách phẳng có parentId → dựng lại thành cây
function buildTree(nodes) {
  if (nodes.some((n) => n.children.length)) return nodes
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const roots = []
  nodes.forEach((n) => {
    const p = n.parentId != null ? byId.get(String(n.parentId)) : null
    if (p && p !== n) p.children.push(n)
    else roots.push(n)
  })
  return roots
}

function normalizeCategories(data) {
  const rows = Array.isArray(data) ? data : (data?.content ?? data?.data ?? [])
  // Dạng 1: mỗi dòng là 1 danh mục có mảng chỉ số bên trong
  if (rows.some((r) => firstArray(r, CATEGORY_KPI_KEYS))) {
    return rows.map((r) => ({
      id: String(r.id ?? r.categoryId ?? r.name),
      name: r.name ?? r.categoryName ?? '(không tên)',
      description: r.description ?? r.desc ?? '',
      kpis: buildTree((firstArray(r, CATEGORY_KPI_KEYS) ?? []).map(toNode)),
    }))
  }
  // Dạng 2: mỗi dòng là 1 chỉ số, mang theo thông tin danh mục → gom nhóm
  const groups = new Map()
  rows.forEach((r) => {
    const cat = r.categoryKpi ?? r.category ?? {}
    const cid = String(r.categoryKpiId ?? r.categoryId ?? cat.id ?? '_')
    if (!groups.has(cid)) {
      groups.set(cid, {
        id: cid,
        name: r.categoryName ?? cat.name ?? 'Chưa phân loại',
        description: cat.description ?? '',
        raw: [],
      })
    }
    groups.get(cid).raw.push(toNode(r))
  })
  return [...groups.values()].map(({ raw, ...c }) => ({ ...c, kpis: buildTree(raw) }))
}

const walk = (nodes, fn) => nodes.forEach((n) => { fn(n); walk(n.children, fn) })
const descendantIds = (node) => {
  const ids = []
  walk([node], (n) => ids.push(n.id))
  return ids
}

// Giữ lại nút khớp từ khóa và toàn bộ tổ tiên của nó
function filterTree(nodes, q) {
  if (!q) return nodes
  return nodes.flatMap((n) => {
    const kids = filterTree(n.children, q)
    const hit = norm(n.name).includes(q) || norm(n.code).includes(q)
    return hit || kids.length ? [{ ...n, children: hit ? n.children : kids }] : []
  })
}

/* ══════════════ Nút chỉ số (đệ quy) ══════════════ */
function KpiNode({ node, depth, selected, expanded, forceOpen, onToggle, onToggleBranch, onExpand }) {
  const hasKids = node.children.length > 0
  const open = forceOpen || expanded.has(node.id)
  const active = selected.has(node.id)
  const branch = hasKids ? descendantIds(node) : null
  const branchAll = branch?.every((id) => selected.has(id))

  return (
    <>
      <div
        onClick={() => onToggle(node.id)}
        className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 py-3 pr-4 ${
          active ? 'border-l-4 border-l-gov-gold bg-gov-navy/5' : 'border-l-4 border-l-transparent hover:bg-gray-50'
        }`}
        style={{ paddingLeft: 12 + depth * 28 }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); if (hasKids) onExpand(node.id) }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${hasKids ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'invisible'}`}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
            active ? 'border-gov-navy bg-gov-navy text-white' : 'border-gray-300 bg-white text-transparent'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${depth ? 'font-medium' : 'font-semibold'} text-gov-slate`}>{node.name}</p>
          {node.code && (
            <p className="truncate text-xs text-gray-500">
              <span className="mr-1.5 text-gray-300">•</span>Mã: {node.code}
            </p>
          )}
        </div>
        {hasKids && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleBranch(branch, !branchAll) }}
            title={branchAll ? 'Bỏ chọn cả nhánh' : 'Chọn chỉ số này và toàn bộ chỉ số con'}
            className={`flex shrink-0 items-center gap-1 border px-2 py-1 text-[10px] font-semibold tracking-wider uppercase ${
              branchAll
                ? 'border-gov-gold bg-gov-gold/10 text-[#8a6f14]'
                : 'border-gray-300 bg-white text-gray-500 hover:border-gov-navy hover:text-gov-navy'
            }`}
          >
            <ListTree className="h-3.5 w-3.5" />
            {branchAll ? 'Bỏ nhánh' : `Chọn nhánh (${branch.length})`}
          </button>
        )}
      </div>
      {open && node.children.map((c) => (
        <KpiNode
          key={c.id}
          node={c}
          depth={depth + 1}
          selected={selected}
          expanded={expanded}
          forceOpen={forceOpen}
          onToggle={onToggle}
          onToggleBranch={onToggleBranch}
          onExpand={onExpand}
        />
      ))}
    </>
  )
}

/* ══════════════ Màn hình chính ══════════════ */
export default function KpiPermissionScreen() {
  const [categories, setCategories] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [listLoading, setListLoading] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [lastSync, setLastSync] = useState(null)

  const [selected, setSelected] = useState(() => new Set())
  const [expanded, setExpanded] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const [emails, setEmails] = useState('')
  const [perm, setPerm] = useState('e')
  const [logs, setLogs] = useState(INIT_LOGS)
  const [isProcessing, setIsProcessing] = useState(false)
  const [failedEmails, setFailedEmails] = useState([])
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [toasts, setToasts] = useState([])

  const logEndRef = useRef(null)
  // Chỉ cuộn khung nhật ký — scrollIntoView sẽ kéo cả màn hình xuống theo
  useEffect(() => {
    const box = logEndRef.current?.parentElement
    if (box) box.scrollTop = box.scrollHeight
  }, [logs])

  const pushToast = (type, title, msg) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((p) => [...p, { id, type, title, msg }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000)
  }
  const dismissToast = (id) => setToasts((p) => p.filter((t) => t.id !== id))
  const addLog = (type, msg) => setLogs((p) => [...p, { time: now(), type, msg }])

  const emailList = emails.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean)

  // id → { name, code, catName } để hiện danh sách đã chọn (xuyên danh mục)
  const index = useMemo(() => {
    const m = new Map()
    categories.forEach((c) => walk(c.kpis, (n) => m.set(n.id, { ...n, catName: c.name })))
    return m
  }, [categories])

  /* ── Tải danh mục chỉ số ── */
  const loadCategories = useCallback(async (isInitial = false) => {
    setListLoading(true)
    setSyncError(null)
    try {
      const res = await apiClient.get('/services/ioc-metadata/api/category-kpis')
      const cats = normalizeCategories(res.data)
      let total = 0
      cats.forEach((c) => walk(c.kpis, () => { total += 1 }))
      setCategories(cats)
      setActiveCat((prev) => (cats.some((c) => c.id === prev) ? prev : cats[0]?.id ?? null))
      setLastSync(new Date())

      // Bỏ khỏi phạm vi chọn những chỉ số không còn trên hệ thống
      const alive = new Set()
      cats.forEach((c) => walk(c.kpis, (n) => alive.add(n.id)))
      setSelected((prev) => new Set([...prev].filter((id) => alive.has(id))))

      if (!total) {
        const rows = Array.isArray(res.data) ? res.data : (res.data?.content ?? [])
        console.log('[category-kpis] dữ liệu gốc:', res.data)
        addLog('error', `⚠ Không nhận diện được chỉ số trong phản hồi. Khóa dòng đầu: ${Object.keys(rows[0] ?? res.data ?? {}).join(', ') || '(rỗng)'}`)
      } else if (isInitial) {
        addLog('success', `✔ Đã tải ${cats.length} danh mục, ${total} chỉ số từ hệ thống.`)
      } else {
        addLog('info', `↻ Làm mới: ${cats.length} danh mục, ${total} chỉ số.`)
      }
    } catch (e) {
      const msg = e?.response ? `HTTP ${e.response.status}` : e.message
      setSyncError(msg)
      addLog('error', `✘ Không tải được danh mục chỉ số (${msg}).`)
    } finally {
      setListLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadCategories(true) }, [loadCategories])

  const cat = categories.find((c) => c.id === activeCat)
  const q = norm(query)
  const visible = filterTree(cat?.kpis ?? [], q)
  const catIds = useMemo(() => {
    const ids = []
    walk(cat?.kpis ?? [], (n) => ids.push(n.id))
    return ids
  }, [cat])
  const catAllSelected = catIds.length > 0 && catIds.every((id) => selected.has(id))

  const toggleOne = (id) => setSelected((p) => {
    const s = new Set(p)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    return s
  })
  const setMany = (ids, on) => setSelected((p) => {
    const s = new Set(p)
    ids.forEach((id) => (on ? s.add(id) : s.delete(id)))
    return s
  })
  const toggleExpand = (id) => setExpanded((p) => {
    const s = new Set(p)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    return s
  })
  const expandAll = (on) => setExpanded(() => {
    if (!on) return new Set()
    const s = new Set()
    walk(cat?.kpis ?? [], (n) => { if (n.children.length) s.add(n.id) })
    return s
  })
  const selectedInCat = (c) => {
    let k = 0
    walk(c.kpis, (n) => { if (selected.has(n.id)) k += 1 })
    return k
  }

  const copyFailedEmails = async () => {
    if (!failedEmails.length) return
    try {
      await navigator.clipboard.writeText(failedEmails.join('\n'))
    } catch {
      const ta = document.createElement('textarea')
      ta.value = failedEmails.join('\n')
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    pushToast('success', 'Đã sao chép', `${failedEmails.length} email lỗi vào clipboard`)
    setTimeout(() => setCopied(false), 2000)
  }

  const askExecute = () => {
    if (!selected.size || !emailList.length) {
      addLog('error', '⚠ Vui lòng chọn chỉ số và nhập ít nhất 1 email.')
      pushToast('error', 'Thiếu dữ liệu đầu vào', 'Cần chọn chỉ số và nhập email trước khi thực thi.')
      return
    }
    setConfirm(true)
  }

  /* ── Cấp quyền: tra cứu toàn bộ email trước, rồi mỗi chỉ số gửi 1 request
     chứa danh sách tất cả tài khoản tra cứu được ── */
  const execute = useCallback(async () => {
    setConfirm(false)
    const list = [...new Set(emails.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean))]
    const targets = [...selected]
    const roleLabel = ROLES.find((r) => r.value === perm)?.label ?? perm
    setIsProcessing(true)
    setFailedEmails([])
    addLog('info', `→ Bắt đầu CẤP QUYỀN CHỈ SỐ | ${list.length} email × ${targets.length} chỉ số | [${roleLabel}]`)

    const failed = []
    const assignees = []
    for (const email of list) {
      addLog('info', `  ⏳ Đang tra cứu tài khoản: ${email}...`)
      try {
        const searchRes = await apiClient.post('/services/uaa/api/search/userInfoModel', {
          q: email, resource: 'table_user',
        })
        const rows = Array.isArray(searchRes.data) ? searchRes.data : []
        const row = rows.find((r) => norm(r?.email) === norm(email)) ?? rows[0]
        if (!row?.resourceId) throw new Error('Không tìm thấy tài khoản')
        assignees.push({ assigneeId: String(row.resourceId), assignee: email, perm, permType: 0 })
        addLog('success', `  ✔ Tìm thấy ID: ${row.resourceId}${row.orgName ? ` — ${row.orgName}` : ''}`)
      } catch (error) {
        failed.push(email)
        addLog('error', `  ✘ Không tra cứu được "${email}": ${error?.response ? `HTTP ${error.response.status}` : error.message}`)
      }
    }
    setFailedEmails(failed)

    let ok = 0
    let bad = 0
    if (assignees.length) {
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const chunk = targets.slice(i, i + CONCURRENCY)
        const results = await Promise.all(chunk.map(async (kpiTypeId) => {
          const name = index.get(kpiTypeId)?.name ?? kpiTypeId
          try {
            await apiClient.post('/services/ioc-metadata/api/kpi-types/acl', assignees, { params: { kpiTypeId } })
            return { name, status: 'success' }
          } catch (err) {
            return { name, status: 'error', msg: err.response?.data?.message || (err.response ? `HTTP ${err.response.status}` : err.message) }
          }
        }))
        results.forEach((r) => {
          if (r.status === 'success') { ok += 1; addLog('success', `    ✓ ${r.name}`) }
          else { bad += 1; addLog('error', `    ✗ ${r.name} — ${r.msg}`) }
        })
      }
    } else {
      addLog('error', '⚠ Không có tài khoản nào tra cứu được — bỏ qua bước cấp quyền.')
    }

    addLog(bad || failed.length ? 'error' : 'success',
      `✔ Hoàn thành. ${ok}/${targets.length} chỉ số thành công cho ${assignees.length} tài khoản${failed.length ? `, ${failed.length} email lỗi` : ''}.`)
    pushToast(bad || failed.length ? 'error' : 'success', 'CẤP QUYỀN CHỈ SỐ hoàn tất',
      `${ok}/${targets.length} chỉ số, ${assignees.length} tài khoản${failed.length ? `, ${failed.length} email lỗi` : ''}.`)
    setIsProcessing(false)
  }, [emails, perm, selected, index])

  const roleLabel = ROLES.find((r) => r.value === perm)?.label ?? perm
  const totalKpis = index.size

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gov-bg">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDialog
        open={confirm}
        title="Xác nhận CẤP QUYỀN chỉ số"
        lines={[
          `Đối tượng: ${emailList.length} tài khoản email`,
          `Phạm vi: ${selected.size} chỉ số được chọn`,
          `Quyền áp dụng: ${roleLabel} (Perm: ${perm})`,
        ]}
        confirmLabel=" Đồng ý CẤP QUYỀN"
        confirmClass="bg-gov-navy hover:bg-gov-navy-dark"
        onConfirm={execute}
        onCancel={() => setConfirm(false)}
      />

      <main className="mx-auto grid w-full 2xl:min-h-[600px] max-w-[1700px] flex-1 grid-cols-1 gap-4 p-6 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_420px]">

        {/* ── Cột 1: Danh mục chỉ số ── */}
        <section className="flex max-h-[75vh] min-h-[320px] flex-col overflow-hidden 2xl:max-h-none border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b-2 border-gov-navy bg-gray-50 px-4 py-3">
            <Folder className="h-4 w-4 text-gov-navy" />
            <h2 className="text-sm font-bold tracking-wider text-gov-navy uppercase">Danh mục chỉ số</h2>
            <div className="flex-1" />
            <button
              onClick={() => loadCategories(false)}
              disabled={listLoading || isProcessing}
              title="Tải lại danh mục từ hệ thống"
              className="flex items-center border border-gov-navy bg-gov-navy p-1.5 text-white hover:bg-gov-navy-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${listLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gov-navy-deep px-4 py-1.5 text-[11px] text-white/70">
            <Activity className={`h-3 w-3 ${listLoading ? 'text-gov-gold' : syncError ? 'text-red-400' : 'text-green-400'}`} />
            {listLoading ? 'Đang tải...' : syncError ? `Lỗi (${syncError})` : lastSync ? `${totalKpis} chỉ số · ${lastSync.toLocaleTimeString('vi-VN')}` : 'Chưa có dữ liệu'}
          </div>
          <div className="flex-1 overflow-y-auto">
            {!categories.length && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                {listLoading ? 'Đang tải danh mục...' : 'Không có danh mục.'}
              </p>
            )}
            {categories.map((c) => {
              const active = c.id === activeCat
              const picked = selectedInCat(c)
              const Icon = active ? FolderOpen : Folder
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left ${
                    active ? 'border-l-4 border-l-gov-navy bg-gov-navy/5' : 'border-l-4 border-l-transparent hover:bg-gray-50'
                  }`}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gov-slate">{c.name}</p>
                    {c.description && c.description !== c.name && (
                      <p className="mt-0.5 text-xs text-gray-500">{c.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">
                        {c.kpis.length} chỉ số
                      </span>
                      {picked > 0 && (
                        <span className="border border-gov-gold bg-gov-gold/10 px-1.5 py-0.5 text-[11px] font-bold text-[#8a6f14]">
                          đã chọn {picked}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Cột 2: Cây chỉ số của danh mục đang chọn ── */}
        <section className="flex max-h-[75vh] min-h-[420px] flex-col overflow-hidden 2xl:max-h-none border border-gray-200 bg-white shadow-sm">
          <div className="border-b-2 border-gov-navy bg-gray-50 px-4 py-3">
            <h2 className="text-lg font-bold text-gov-navy">{cat?.name ?? 'Chưa chọn danh mục'}</h2>
            {cat?.description && <p className="text-xs text-gray-500">{cat.description}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-3">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-gov-navy focus-within:ring-2 focus-within:ring-gov-navy/20">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tra cứu theo tên hoặc mã chỉ số..."
                className="w-full bg-transparent text-sm text-gov-slate outline-none placeholder:text-gray-400"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gov-navy">
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setMany(catIds, !catAllSelected)}
              disabled={!catIds.length}
              className="border border-gov-navy bg-gov-navy px-3 py-2 text-[11px] font-semibold tracking-wider text-white uppercase hover:bg-gov-navy-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {catAllSelected ? 'Bỏ chọn danh mục' : `Chọn cả danh mục (${catIds.length})`}
            </button>
            <button onClick={() => expandAll(true)} title="Mở rộng tất cả" className="border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-100">
              <ChevronsUpDown className="h-4 w-4" />
            </button>
            <button onClick={() => expandAll(false)} title="Thu gọn tất cả" className="border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-100">
              <ChevronsDownUp className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!visible.length && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                {listLoading ? 'Đang tải chỉ số...' : q ? 'Không tìm thấy chỉ số khớp với từ khóa.' : 'Danh mục chưa có chỉ số.'}
              </p>
            )}
            {visible.map((n) => (
              <KpiNode
                key={n.id}
                node={n}
                depth={0}
                selected={selected}
                expanded={expanded}
                forceOpen={!!q}
                onToggle={toggleOne}
                onToggleBranch={setMany}
                onExpand={toggleExpand}
              />
            ))}
          </div>

          <div className="flex items-center justify-between border-t-2 border-gov-navy bg-gov-navy px-4 py-2 text-white">
            <span className="text-xs font-medium tracking-wider uppercase opacity-80">Tổng chỉ số đã chọn (mọi danh mục)</span>
            <span className="font-mono text-sm font-bold text-gov-gold">{selected.size} / {totalKpis}</span>
          </div>
        </section>

        {/* ── Cột 3: Đối tượng + nhật ký ── */}
        <div className="flex flex-col gap-4 lg:col-span-2 2xl:col-span-1 2xl:min-h-0">
          <section className="border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b-2 border-gov-navy bg-gray-50 px-4 py-3">
              <Mail className="h-4 w-4 text-gov-navy" />
              <h2 className="text-sm font-bold tracking-wider text-gov-navy uppercase">Đối tượng và thẩm quyền</h2>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-600 uppercase">
                  Danh sách email tài khoản
                </label>
                <textarea
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder={'nguyenvana@moj.gov.vn\ntranthib@moj.gov.vn'}
                  rows={5}
                  spellCheck={false}
                  className="w-full resize-y border border-gray-300 bg-gray-50 p-3 font-mono text-sm text-gov-slate outline-none placeholder:text-gray-400 focus:border-gov-navy focus:bg-white focus:ring-2 focus:ring-gov-navy/20"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Mỗi email một dòng (hoặc cách nhau bởi dấu phẩy) — {emailList.length} tài khoản đã nhập.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-600 uppercase">
                  Quyền áp dụng trên chỉ số
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const active = perm === r.value
                    return (
                      <button
                        key={r.value}
                        onClick={() => setPerm(r.value)}
                        className={`flex items-center gap-2 border px-3 py-2.5 text-left ${
                          active ? 'border-gov-navy bg-gov-navy text-white' : 'border-gray-300 bg-white text-gov-slate hover:border-gov-navy/50 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-gov-gold' : 'border-gray-400'}`}>
                          {active && <span className="h-2 w-2 rounded-full bg-gov-gold" />}
                        </span>
                        <span className="flex-1 text-sm font-semibold">{r.label}</span>
                        <span className={`font-mono text-[11px] ${active ? 'text-gov-gold' : 'text-gray-500'}`}>{r.perm}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold tracking-wider text-gray-600 uppercase">
                    Chỉ số đã chọn ({selected.size})
                  </label>
                  {selected.size > 0 && (
                    <button onClick={() => setSelected(new Set())} className="text-[11px] font-semibold text-red-800 uppercase hover:underline">
                      Bỏ chọn tất cả
                    </button>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-200 bg-gray-50">
                  {!selected.size && <p className="px-3 py-3 text-xs text-gray-400">Chưa chọn chỉ số nào.</p>}
                  {[...selected].map((id) => {
                    const k = index.get(id)
                    return (
                      <div key={id} className="flex items-center gap-2 border-b border-gray-100 px-3 py-1.5 text-xs last:border-b-0">
                        <span className="min-w-0 flex-1 truncate text-gov-slate" title={`${k?.catName ?? ''} › ${k?.name ?? id}`}>
                          <span className="text-gray-400">{k?.catName} › </span>{k?.name ?? id}
                        </span>
                        <button onClick={() => toggleOne(id)} className="text-gray-400 hover:text-red-700">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={askExecute}
                disabled={isProcessing}
                className="flex w-full items-center justify-center gap-2 border border-gov-navy-dark bg-gov-navy px-4 py-3 text-sm font-bold tracking-wider text-white uppercase hover:bg-gov-navy-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ShieldCheck className="h-5 w-5" />
                {isProcessing ? 'Đang xử lý...' : `Cấp quyền ${selected.size} chỉ số × ${emailList.length} tài khoản`}
              </button>
            </div>

            {failedEmails.length > 0 && (
              <div className="border-t-4 border-red-700 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-red-900">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm font-bold tracking-wide uppercase">Email không tra cứu được</span>
                  <span className="border border-red-700 bg-red-700 px-2 py-0.5 text-xs font-bold text-white">{failedEmails.length}</span>
                </div>
                <pre className="mt-2 max-h-32 overflow-auto border border-red-200 bg-white p-3 font-mono text-xs text-red-900">
{failedEmails.join('\n')}
                </pre>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={copyFailedEmails}
                    className={`flex items-center gap-2 border px-3 py-2 text-xs font-semibold tracking-wider uppercase ${
                      copied ? 'border-green-700 bg-green-700 text-white' : 'border-gov-navy bg-white text-gov-navy hover:bg-gov-navy/5'
                    }`}
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? 'Đã sao chép' : 'Sao chép danh sách'}
                  </button>
                  <button
                    onClick={() => setFailedEmails([])}
                    className="flex items-center gap-2 border border-gray-400 bg-white px-3 py-2 text-xs font-semibold tracking-wider text-gray-600 uppercase hover:bg-gray-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa danh sách
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="flex min-h-[300px] flex-1 flex-col border border-gray-200 bg-white shadow-sm 2xl:min-h-0">
            <div className="flex items-center gap-3 border-b-2 border-gov-navy bg-gray-50 px-4 py-3">
              <ScrollText className="h-4 w-4 text-gov-navy" />
              <h2 className="text-sm font-bold tracking-wider text-gov-navy uppercase">Nhật ký kiểm toán</h2>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                <Activity className={`h-3.5 w-3.5 ${isProcessing ? 'text-gov-gold' : 'text-green-600'}`} />
                {isProcessing ? 'Đang ghi nhận' : 'Trực tiếp'}
              </span>
              <div className="flex-1" />
              <button
                onClick={() => setLogs(INIT_LOGS)}
                className="border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-semibold tracking-wider text-gray-600 uppercase hover:bg-gray-100"
              >
                Xóa nhật ký
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-gov-navy-deep p-3 font-mono text-xs" style={{ minHeight: 220 }}>
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3 py-0.5">
                  <span className="shrink-0 text-gray-500">{log.time}</span>
                  <span className={log.type === 'success' ? 'text-green-400' : log.type === 'error' ? 'text-red-400' : 'text-gray-300'}>
                    {log.msg}
                  </span>
                </div>
              ))}
              <div style={{ height: 1 }} ref={logEndRef} />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
