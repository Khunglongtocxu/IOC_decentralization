import '../module.css'
import { BarChart3 } from 'lucide-react'
import { ModuleShell, mountModule } from '../mount'
import ReportPermissionScreen from '../../components/ReportPermissionScreen'

mountModule(
  <ModuleShell
    title="Phân quyền biểu đồ báo cáo"
    subtitle="Cấp / gỡ quyền xem, sửa · đặt trang chủ"
    icon={BarChart3}
    tabs={[{ id: 'main', label: 'Phân quyền', component: ReportPermissionScreen }]}
  />,
)
