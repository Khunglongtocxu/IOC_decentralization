import '../module.css'
import { Users } from 'lucide-react'
import { ModuleShell, mountModule } from '../mount'
import UserPermissionScreen from '../../components/UserPermissionScreen'
import IOCPermissionChecker from '../../components/IOCPermissionChecker'

mountModule(
  <ModuleShell
    title="Phân quyền người dùng IOC"
    subtitle="Thêm / gỡ nhóm quyền · kiểm tra tài khoản"
    icon={Users}
    tabs={[
      { id: 'grant', label: 'Cấp / gỡ quyền', component: UserPermissionScreen },
      { id: 'check', label: 'Kiểm tra TK', component: IOCPermissionChecker },
    ]}
  />,
)
