import '../module.css'
import { Gauge } from 'lucide-react'
import { ModuleShell, mountModule } from '../mount'
import KpiPermissionScreen from '../../components/KpiPermissionScreen'

mountModule(
  <ModuleShell
    title="Phân quyền chỉ số"
    subtitle="Cấp quyền chỉ số mẹ / con cho nhiều tài khoản"
    icon={Gauge}
    tabs={[{ id: 'main', label: 'Phân quyền', component: KpiPermissionScreen }]}
  />,
)
