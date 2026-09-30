/**
 * Backend Node.js dùng chung cho các module IOC trong App FPT-IS (đóng gói thành main.js).
 * Frontend gửi request qua ipcRenderer.invoke('module-backend-invoke') → app chủ chuyển
 * { id, action, payload } vào tiến trình này; trả về { id, success, data | error }.
 */
const https = require('https');
const { URL } = require('url');
const os = require('os');

const MODULE_ID = process.env.MODULE_ID || 'ioc-module';
const AUTH_URL = 'https://eaccount.kyta.fpt.com/auth/login';
const ADMIN = { username: 'kyta.fpt.ioc@gmail.com', password: 'admin@123' };

// Chỉ gọi (và gắn token) tới các máy chủ này — backend không phải proxy mở
const API_HOSTS = ['iocthads.moj.gov.vn', 'eaccount.kyta.fpt.com'];
// Ghi log Google Sheet: gửi GET, không cần đọc phản hồi
const FIRE_HOSTS = ['script.google.com'];

let accessToken = null;
let loginPromise = null;

function request(method, urlStr, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const data = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const h = { ...headers };
    if (data != null) h['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(
      { hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method, headers: h },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          statusText: res.statusMessage || '',
          headers: { 'content-type': res.headers['content-type'] || '' },
          body: Buffer.concat(chunks).toString('utf8'),
        }));
      }
    );
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('Hết thời gian chờ phản hồi (60s)')));
    if (data != null) req.write(data);
    req.end();
  });
}

// Nhiều request cùng gặp 401 → chỉ đăng nhập 1 lần
function login() {
  if (!loginPromise) {
    loginPromise = (async () => {
      const r = await request('POST', AUTH_URL, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: ADMIN,
      });
      if (r.status >= 400) throw new Error(`Đăng nhập thất bại: HTTP ${r.status}`);
      const j = JSON.parse(r.body || '{}');
      accessToken = j.access_token || j.accessToken || null;
      if (!accessToken) throw new Error('Không lấy được access_token');
    })().finally(() => { loginPromise = null; });
  }
  return loginPromise;
}

async function apiCall({ method = 'GET', url, headers = {}, data = null }) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !API_HOSTS.includes(u.hostname)) {
    throw new Error(`Máy chủ không được phép: ${u.hostname}`);
  }
  if (!accessToken) await login();
  const contentType = headers['Content-Type'] || headers['content-type'] || 'application/json';
  const send = () => request(method, url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${accessToken}`,
      ...(data != null ? { 'Content-Type': contentType } : {}),
    },
    body: data,
  });
  let r = await send();
  if (r.status === 401) {
    await login();
    r = await send();
  }
  return r;
}

function fire(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !FIRE_HOSTS.includes(u.hostname)) {
    throw new Error(`Máy chủ không được phép: ${u.hostname}`);
  }
  // Không chờ kết quả — lỗi ghi log không được làm gián đoạn phân quyền
  request('GET', url).catch(() => {});
  return { queued: true };
}

console.log(`[Node.js Backend] "${MODULE_ID}" started PID ${process.pid}`);

process.on('message', async (msg) => {
  if (!msg || !msg.id) return;
  const { id, action, payload = {} } = msg;
  try {
    let result;
    switch (action) {
      case 'ping':
        result = { pong: true, pid: process.pid, hostname: os.hostname() };
        break;
      case 'hostname':
        result = os.hostname();
        break;
      case 'http':
        result = await apiCall(payload);
        break;
      case 'fire':
        result = fire(payload.url);
        break;
      default:
        throw new Error(`Action "${action}" không được hỗ trợ`);
    }
    if (process.send) process.send({ id, success: true, data: result });
  } catch (error) {
    if (process.send) process.send({ id, success: false, error: error.message });
  }
});
