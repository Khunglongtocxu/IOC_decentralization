/* ══════════════ Giao tiếp frontend module ↔ backend main.js (App FPT-IS) ══════════════ */
// Chạy trong App FPT-IS, renderer không tự gọi API: mọi request đi qua
// ipcRenderer.invoke('module-backend-invoke') → backend Node (main.js) gắn token rồi gọi thật.
import axios, { AxiosError, AxiosHeaders } from 'axios'

export const MODULE_ID = __IOC_MODULE_ID__

export const ipc = typeof window !== 'undefined' && typeof window.require === 'function'
  ? window.require('electron').ipcRenderer
  : null

export async function backendInvoke(action, payload = {}) {
  if (!ipc) throw new Error('Chỉ chạy trong App FPT-IS (cần backend Node.js)')
  const res = await ipc.invoke('module-backend-invoke', { moduleId: MODULE_ID, action, payload })
  if (!res?.success) throw new Error(res?.error || 'Lỗi backend')
  return res.data
}

// Adapter axios: giữ nguyên hành vi apiClient/eaccountClient (response, lỗi e.response.status...)
// để các màn hình dùng lại không phải sửa
export async function moduleAdapter(config) {
  const res = await backendInvoke('http', {
    method: (config.method || 'get').toUpperCase(),
    url: axios.getUri(config),
    headers: AxiosHeaders.from(config.headers).toJSON(),
    data: config.data ?? null,
  })
  const response = {
    data: res.body,
    status: res.status,
    statusText: res.statusText || '',
    headers: AxiosHeaders.from(res.headers || {}),
    config,
    request: null,
  }
  if (!config.validateStatus || config.validateStatus(response.status)) return response
  throw new AxiosError(
    `Request failed with status code ${response.status}`,
    response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config, null, response,
  )
}
