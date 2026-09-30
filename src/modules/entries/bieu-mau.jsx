import '../module.css'
import { FileText } from 'lucide-react'
import { ModuleShell, mountModule } from '../mount'
import PermissionScreen from '../../components/PermissionScreen'
import FormPermissionChecker from '../../components/FormPermissionChecker'

mountModule(
  <ModuleShell
    title="Phân quyền biểu mẫu"
    subtitle="Cấp / gỡ quyền biểu mẫu · kiểm tra quyền"
    icon={FileText}
    tabs={[
      { id: 'grant', label: 'Phân quyền biểu mẫu', component: PermissionScreen },
      { id: 'check', label: 'Kiểm tra quyền', component: FormPermissionChecker },
    ]}
  />,
)
