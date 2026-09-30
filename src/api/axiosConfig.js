import axios from "axios";
import { moduleAdapter, backendInvoke } from "../modules/transport";

// Khi đóng gói Electron (file://) không có Vite proxy → dùng URL trực tiếp
const isElectron = window.location.protocol === 'file:';

// Module App FPT-IS (__IOC_MODULE__): request đi qua backend main.js — backend tự đăng nhập,
// gắn token và thử lại khi 401, nên renderer bỏ qua phần token bên dưới
const apiClient = axios.create({
    baseURL: __IOC_MODULE__ || isElectron ? 'https://iocthads.moj.gov.vn/' : '/api-eioc',
    headers: { 'Content-Type': 'application/json' },
    ...(__IOC_MODULE__ ? { adapter: moduleAdapter } : {}),
});

const LOGIN_URL = isElectron ? 'https://eaccount.kyta.fpt.com/auth/login' : '/api-auth/auth/login';

const ADMIN_ACCOUNT = {
    username: "kyta.fpt.ioc@gmail.com",
    password: "admin@123"
};

let currentAccessToken = __IOC_MODULE__ ? null : (localStorage.getItem('access_token') || null);
let isRefreshing = false;

export const getAccessToken = () => currentAccessToken;

// Tài khoản thực hiện thao tác: giải mã từ access token (JWT);
// token thiếu/lỗi thì dùng tài khoản tự động đăng nhập của app
export function getCurrentAccount() {
    try {
        const base64 = currentAccessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)));
        return payload.user_name || payload.userName || payload.email || payload.sub || ADMIN_ACCOUNT.username;
    } catch {
        return ADMIN_ACCOUNT.username;
    }
}

// Người thực hiện ghi vào log phân quyền: hostname máy đang chạy app (lấy qua IPC
// của Electron, cache lại sau lần đầu); chạy bằng trình duyệt thường thì dùng
// tài khoản từ token làm phương án dự phòng
let cachedOperator = null;
export async function getOperatorAccount() {
    if (cachedOperator) return cachedOperator;
    try {
        if (__IOC_MODULE__) {
            cachedOperator = await backendInvoke('hostname');
        } else if (window.electronAPI?.hostname) {
            cachedOperator = await window.electronAPI.hostname();
        }
    } catch { /* bỏ qua, dùng phương án dự phòng bên dưới */ }
    if (!cachedOperator) cachedOperator = getCurrentAccount();
    return cachedOperator;
}

apiClient.interceptors.request.use(config => {
    if (currentAccessToken){
        config.headers['Authorization'] = `Bearer ${currentAccessToken}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    res => res,
    async error => {
        const originalRequest = error.config;
        if (!__IOC_MODULE__ && error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    setTimeout(() => resolve(apiClient(originalRequest)), 500);
                });
            }
            originalRequest._retry = true;
            isRefreshing = true;
            try {
                await autoLogin();
                originalRequest.headers['Authorization'] = `Bearer ${currentAccessToken}`;
                return apiClient(originalRequest);
            } catch (loginError) {
                return Promise.reject(loginError);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

export async function autoLogin() {
    try {
        const response = await axios.post(LOGIN_URL, ADMIN_ACCOUNT);
        currentAccessToken = response.data.access_token;
        localStorage.setItem('access_token', currentAccessToken);
        console.log(" Đã lấy Access Token mới thành công.");
    } catch (error) {
        console.error(" Lỗi Auto Login:", error);
        currentAccessToken = null;
        localStorage.removeItem('access_token');
    }
}

if (!__IOC_MODULE__ && !currentAccessToken) {
    autoLogin();
}

export default apiClient;