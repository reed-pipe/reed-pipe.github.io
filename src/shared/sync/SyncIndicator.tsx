import { Button, Tooltip, message } from 'antd'
import {
  CloudSyncOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useSyncStore } from './store'
import { useAuthStore } from '../auth/store'
import { useDb } from '../db/context'
import { pushData, pullData } from './sync'

export default function SyncIndicator() {
  const { syncing, lastSynced, error } = useSyncStore()
  const { cryptoKey, dataGistId } = useAuthStore()
  const db = useDb()

  const handleManualSync = async () => {
    if (!cryptoKey || !dataGistId) {
      message.warning('需要重新登录以启用同步')
      return
    }
    useSyncStore.getState().setSyncing(true)
    try {
      await pushData(db, cryptoKey, dataGistId)
      useSyncStore.getState().setSynced()
      message.success('同步完成')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed'
      useSyncStore.getState().setError(msg)
      message.error(`同步失败: ${msg}`)
    }
  }

  const handlePull = async () => {
    if (!cryptoKey || !dataGistId) {
      message.warning('需要重新登录以启用同步')
      return
    }
    useSyncStore.getState().setSyncing(true)
    try {
      await pullData(db, cryptoKey, dataGistId)
      useSyncStore.getState().setSynced()
      message.success('数据已拉取')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull failed'
      useSyncStore.getState().setError(msg)
      message.error(`拉取失败: ${msg}`)
    }
  }

  let icon = <CloudSyncOutlined />
  let tooltip = '点击推送数据'
  let color: string | undefined

  if (syncing) {
    icon = <SyncOutlined spin />
    tooltip = '同步中...'
  } else if (error) {
    icon = <WarningOutlined />
    tooltip = `同步出错: ${error}`
    color = '#faad14'
  } else if (lastSynced) {
    icon = <CheckCircleOutlined />
    const timeStr = new Date(lastSynced).toLocaleTimeString()
    tooltip = `上次同步: ${timeStr}`
    color = '#52c41a'
  }

  if (!cryptoKey) {
    return (
      <Tooltip title="未同步（需重新登录）">
        <Button type="text" size="small" icon={<CloudSyncOutlined />} disabled />
      </Tooltip>
    )
  }

  return (
    <Tooltip title={tooltip}>
      <Button
        type="text"
        size="small"
        icon={icon}
        onClick={handleManualSync}
        onContextMenu={(e) => {
          e.preventDefault()
          void handlePull()
        }}
        style={{ color }}
        loading={syncing}
      />
    </Tooltip>
  )
}
