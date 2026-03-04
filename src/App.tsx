import { useEffect } from 'react'
import { useRoutes } from 'react-router-dom'
import { ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { routes } from './router'
import AppLayout from './shared/components/AppLayout'
import LoginPage from './shared/auth/LoginPage'
import { useAuthStore } from './shared/auth/store'
import { DbProvider } from './shared/db/context'
import { useSyncStore } from './shared/sync/store'
import { pullData } from './shared/sync/sync'
import { useDb } from './shared/db/context'

function SyncOnMount() {
  const { cryptoKey, dataGistId } = useAuthStore()
  const db = useDb()

  useEffect(() => {
    if (!cryptoKey || !dataGistId) return
    const { setSyncing, setSynced, setError } = useSyncStore.getState()
    setSyncing(true)
    pullData(db, cryptoKey, dataGistId)
      .then(() => setSynced())
      .catch((err) => setError(err instanceof Error ? err.message : 'Pull failed'))
  }, [cryptoKey, dataGistId, db])

  return null
}

function AuthenticatedApp() {
  const element = useRoutes(routes)
  const { username } = useAuthStore()

  return (
    <DbProvider username={username!}>
      <SyncOnMount />
      <AppLayout>{element}</AppLayout>
    </DbProvider>
  )
}

export default function App() {
  const { username, initialized, init } = useAuthStore()

  useEffect(() => {
    void init()
  }, [init])

  if (!initialized) {
    return (
      <ConfigProvider locale={zhCN}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Spin size="large" />
        </div>
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider locale={zhCN}>
      {username ? <AuthenticatedApp /> : <LoginPage />}
    </ConfigProvider>
  )
}
