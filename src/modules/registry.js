/* ══════════════ Danh sách module đóng gói cho App FPT-IS ══════════════ */
// Dùng chung cho script build (scripts/build-modules.mjs) và nút "Tải module" trong app.
// Mỗi module → 1 file zip: manifest.json + index.js + index.css + main.js
export const MODULE_META = {
  category: 'IOC Phân quyền',
  author: 'IOC',
  requiredRole: 'custom',
}

export const MODULES = [
  {
    id: 'ioc-phan-quyen-nguoi-dung',
    name: 'Phân quyền người dùng IOC',
    description: 'Thêm / gỡ tài khoản khỏi nhóm quyền IOC theo đơn vị (khu vực, tỉnh, cấp cục) và kiểm tra tài khoản',
    icon: 'Users',
    globalName: 'IocUserPermission',
    entry: 'src/modules/entries/nguoi-dung.jsx',
  },
  {
    id: 'ioc-phan-quyen-bieu-mau',
    name: 'Phân quyền biểu mẫu',
    description: 'Cấp / gỡ quyền biểu mẫu cho nhiều tài khoản và kiểm tra quyền biểu mẫu',
    icon: 'FileText',
    globalName: 'IocFormPermission',
    entry: 'src/modules/entries/bieu-mau.jsx',
  },
  {
    id: 'ioc-phan-quyen-bieu-do-bao-cao',
    name: 'Phân quyền biểu đồ báo cáo',
    description: 'Cấp / gỡ quyền xem, sửa biểu đồ báo cáo và đặt trang chủ cho tài khoản',
    icon: 'BarChart3',
    globalName: 'IocReportPermission',
    entry: 'src/modules/entries/bieu-do-bao-cao.jsx',
  },
  {
    id: 'ioc-phan-quyen-chi-so',
    name: 'Phân quyền chỉ số',
    description: 'Cấp quyền chỉ số (mẹ / con) cho nhiều tài khoản cùng lúc',
    icon: 'Gauge',
    globalName: 'IocKpiPermission',
    entry: 'src/modules/entries/chi-so.jsx',
  },
]

export const moduleZipName = (id, version) => `${id}-${version}.zip`
