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
import { pullData, pushData } from './shared/sync/sync'
import { useDb } from './shared/db/context'

function SyncOnMount() {
  const { cryptoKey, dataGistId } = useAuthStore()
  const db = useDb()

  useEffect(() => {
    async function init() {
      // 首次登录：迁移旧数据库数据
      const { migrateLegacyData } = await import('./shared/db/migrate-legacy')
      await migrateLegacyData(db)

      // 同步云端数据
      if (!cryptoKey || !dataGistId) return
      const { setSyncing, setSynced, setError } = useSyncStore.getState()
      setSyncing(true)
      try {
        const pulled = await pullData(db, cryptoKey, dataGistId)
        if (!pulled) {
          // 云端为空（新注册或迁移后），推送本地数据上去
          const count = await db.weightRecords.count() + await db.kv.count()
          if (count > 0) {
            await pushData(db, cryptoKey, dataGistId)
          }
        }
        setSynced()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Pull failed')
      }
    }
    void init()
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
