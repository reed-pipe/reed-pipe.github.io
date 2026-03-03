import { useRoutes } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { routes } from './router'
import AppLayout from './shared/components/AppLayout'

export default function App() {
  const element = useRoutes(routes)

  return (
    <ConfigProvider locale={zhCN}>
      <AppLayout>{element}</AppLayout>
    </ConfigProvider>
  )
}
